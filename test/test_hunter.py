import uuid

from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.db.models import AuditLog, HunterAlert
from app.main import app


client = TestClient(app)


def _register(prefix: str) -> tuple[str, str]:
    email = f"{prefix.lower()}_{uuid.uuid4().hex[:8]}@example.com"
    password = "SecurePass123"
    response = client.post(
        "/api/v1/auth/register",
        json={
            "organization_name": f"{prefix} Org {uuid.uuid4().hex[:8]}",
            "name": f"{prefix} Admin",
            "email": email,
            "password": password,
            "confirm_password": password,
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()
    return data["token"], data["tenant"]["id"]


def _create_application(token: str, email: str, reference: str) -> str:
    response = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "reference_code": reference,
            "applicant_name": "Shared Applicant",
            "applicant_email": email,
            "loan_type": "personal",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["id"]


def _mark_active(application_id: str) -> None:
    with SessionLocal() as db:
        from app.db.models import Application

        application = db.get(Application, application_id)
        assert application is not None
        application.status = "active"
        db.commit()


def test_hunter_no_duplicate_continues_and_persists_audit_event():
    token, tenant_id = _register("HunterSolo")
    application_id = _create_application(token, "solo@example.com", "HUNTER-SOLO")

    response = client.post(
        f"/api/v1/hunter/applications/{application_id}/check",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"duplicate_detected": False, "action": "CONTINUE"}
    with SessionLocal() as db:
        event = db.query(AuditLog).filter_by(
            resource_id=application_id,
            tenant_id=tenant_id,
            action="HUNTER_CHECK_COMPLETED",
        ).one()
        assert event.action == "HUNTER_CHECK_COMPLETED"


def test_hunter_detects_cross_tenant_duplicate_and_persists_privacy_safe_alerts():
    token_a, tenant_a = _register("HunterExisting")
    token_b, tenant_b = _register("HunterCurrent")
    email = "shared@example.com"
    existing_id = _create_application(token_a, email, "HUNTER-EXISTING")
    current_id = _create_application(token_b, email, "HUNTER-CURRENT")
    _mark_active(existing_id)
    _mark_active(current_id)

    response = client.post(
        f"/api/v1/hunter/applications/{current_id}/check",
        headers={"Authorization": f"Bearer {token_b}"},
    )

    assert response.status_code == 200, response.text
    result = response.json()
    assert result["severity"] == "HIGH"
    assert result["action"] == "BANK_REVIEW"
    assert "applicant" not in result
    assert "existing" not in result

    with SessionLocal() as db:
        alerts = db.query(HunterAlert).filter_by(application_id=current_id).all()
        assert {alert.recipient_tenant_id for alert in alerts} == {tenant_a, tenant_b}
        tenant_b_alert = next(alert for alert in alerts if alert.recipient_tenant_id == tenant_b)
        assert tenant_b_alert.message == "Potential duplicate loan application detected."
        audit = db.query(AuditLog).filter_by(
            resource_id=current_id,
            tenant_id=tenant_b,
            action="HUNTER_DUPLICATE_DETECTED",
        ).one()
        assert audit.action == "HUNTER_DUPLICATE_DETECTED"
        assert audit.metadata_data["cross_tenant_match"] is True


def test_hunter_alerts_are_tenant_isolated_and_survive_fresh_session():
    token_a, _ = _register("HunterAlertA")
    token_b, _ = _register("HunterAlertB")
    email = "isolated@example.com"
    existing_id = _create_application(token_a, email, "HUNTER-ISOLATED-A")
    current_id = _create_application(token_b, email, "HUNTER-ISOLATED-B")
    _mark_active(existing_id)
    _mark_active(current_id)

    check = client.post(
        f"/api/v1/hunter/applications/{current_id}/check",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert check.status_code == 200, check.text

    with SessionLocal() as fresh_session:
        persisted = fresh_session.query(HunterAlert).filter_by(application_id=current_id).all()
        assert persisted

    alerts_a = client.get("/api/v1/hunter/alerts", headers={"Authorization": f"Bearer {token_a}"})
    alerts_b = client.get("/api/v1/hunter/alerts", headers={"Authorization": f"Bearer {token_b}"})
    assert alerts_a.status_code == alerts_b.status_code == 200
    assert all(alert["recipient_tenant_id"] != alerts_b.json()[0]["recipient_tenant_id"] for alert in alerts_a.json())
    assert all("applicant_name" not in alert and "applicant_email" not in alert for alert in alerts_b.json())