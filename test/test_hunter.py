import uuid

import pytest
from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.db.models import Application, AuditLog, HunterAlert
from app.main import app
from app.services.hunter_service import hunter_service
from test.tenant_approval_helpers import approve_tenant


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
    approve_tenant(client, data["tenant"]["id"])
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


def _set_application_status(application_id: str, status: str) -> None:
    with SessionLocal() as db:
        application = db.get(Application, application_id)
        assert application is not None
        application.status = status
        db.commit()


def test_hunter_no_duplicate_continues_and_persists_audit_event():
    token, tenant_id = _register("HunterSolo")
    application_id = _create_application(token, "solo@example.com", "HUNTER-SOLO")

    with SessionLocal() as db:
        assert db.query(HunterAlert).filter_by(application_id=application_id).count() == 0
        automatic_event_count = db.query(AuditLog).filter_by(
            resource_id=application_id,
            tenant_id=tenant_id,
            action="HUNTER_CHECK_COMPLETED",
        ).count()
        assert automatic_event_count == 1

    response = client.post(
        f"/api/v1/hunter/applications/{application_id}/check",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"duplicate_detected": False, "action": "CONTINUE"}
    with SessionLocal() as db:
        events = db.query(AuditLog).filter_by(
            resource_id=application_id,
            tenant_id=tenant_id,
            action="HUNTER_CHECK_COMPLETED",
        ).all()
        assert len(events) == 2


def test_hunter_detects_cross_tenant_duplicate_and_persists_privacy_safe_alerts():
    token_a, tenant_a = _register("HunterExisting")
    token_b, tenant_b = _register("HunterCurrent")
    email = "hunter.demo@example.com"
    existing_id = _create_application(token_a, email, "HUNTER-EXISTING")
    _set_application_status(existing_id, "in_review")
    create_response = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token_b}"},
        json={
            "reference_code": "HUNTER-CURRENT",
            "applicant_name": "Shared Applicant",
            "applicant_email": email,
            "loan_type": "personal",
        },
    )
    assert create_response.status_code == 200, create_response.text
    created_application = create_response.json()
    current_id = created_application["id"]
    assert created_application["tenant_id"] == tenant_b
    assert created_application["status"] == "in_review"
    assert "duplicate_detected" not in created_application
    _set_application_status(current_id, "in_review")

    assert tenant_a != tenant_b
    with SessionLocal() as db:
        existing_application = db.get(Application, existing_id)
        current_application = db.get(Application, current_id)
        assert existing_application is not None and existing_application.status == "in_review"
        assert current_application is not None and current_application.status == "in_review"
        assert existing_application.tenant_id != current_application.tenant_id
        assert existing_application.applicant_email == current_application.applicant_email == email
        assert existing_application.loan_type == current_application.loan_type == "personal"

    with SessionLocal() as db:
        automatic_alerts = db.query(HunterAlert).filter_by(application_id=current_id).all()
        assert {alert.recipient_tenant_id for alert in automatic_alerts} == {tenant_a, tenant_b}
        automatic_alert_ids = {alert.alert_id for alert in automatic_alerts}

    response = client.post(
        f"/api/v1/hunter/applications/{current_id}/check",
        headers={"Authorization": f"Bearer {token_b}"},
    )

    assert response.status_code == 200, response.text
    result = response.json()
    assert result["action"] == "BANK_REVIEW"
    assert result["severity"] == "HIGH"
    assert "applicant" not in result
    assert "existing" not in result

    with SessionLocal() as db:
        alerts = db.query(HunterAlert).filter_by(application_id=current_id).all()
        assert {alert.recipient_tenant_id for alert in alerts} == {tenant_a, tenant_b}
        assert len(alerts) == 2
        assert {alert.alert_id for alert in alerts} == automatic_alert_ids
        tenant_b_alert = next(alert for alert in alerts if alert.recipient_tenant_id == tenant_b)
        assert tenant_b_alert.message == "Potential duplicate loan application detected."
        tenant_a_alert = next(alert for alert in alerts if alert.recipient_tenant_id == tenant_a)
        assert tenant_a_alert.message == "A potential duplicate loan application has been detected for this applicant."
        audits = db.query(AuditLog).filter_by(
            resource_id=current_id,
            tenant_id=tenant_b,
            action="HUNTER_DUPLICATE_DETECTED",
        ).all()
        assert len(audits) == 2
        assert all(audit.metadata_data["cross_tenant_match"] is True for audit in audits)


def test_hunter_alerts_are_tenant_isolated_and_survive_fresh_session():
    token_a, _ = _register("HunterAlertA")
    token_b, _ = _register("HunterAlertB")
    email = "isolated@example.com"
    existing_id = _create_application(token_a, email, "HUNTER-ISOLATED-A")
    current_id = _create_application(token_b, email, "HUNTER-ISOLATED-B")
    _set_application_status(existing_id, "in_review")
    _set_application_status(current_id, "in_review")

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


def test_hunter_ignores_completed_and_rejected_cross_tenant_applications():
    token_completed, tenant_completed = _register("HunterCompleted")
    token_rejected, tenant_rejected = _register("HunterRejected")
    token_current, tenant_current = _register("HunterTerminalCurrent")
    email = "terminal@example.com"
    completed_id = _create_application(token_completed, email, "HUNTER-COMPLETED")
    _set_application_status(completed_id, "completed")
    rejected_id = _create_application(token_rejected, email, "HUNTER-REJECTED")
    _set_application_status(rejected_id, "rejected")
    current_id = _create_application(token_current, email, "HUNTER-TERMINAL-CURRENT")
    _set_application_status(current_id, "in_review")

    assert len({tenant_completed, tenant_rejected, tenant_current}) == 3
    response = client.post(
        f"/api/v1/hunter/applications/{current_id}/check",
        headers={"Authorization": f"Bearer {token_current}"},
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"duplicate_detected": False, "action": "CONTINUE"}
    with SessionLocal() as db:
        assert db.query(HunterAlert).filter_by(application_id=current_id).count() == 0


def test_hunter_failure_rolls_back_application_creation(monkeypatch):
    token, tenant_id = _register("HunterFailure")

    def fail_check(*args, **kwargs):
        raise RuntimeError("Hunter check failed.")

    monkeypatch.setattr(hunter_service, "check_application", fail_check)
    with pytest.raises(RuntimeError, match="Hunter check failed"):
        client.post(
            "/api/v1/applications",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "reference_code": "HUNTER-FAILURE",
                "applicant_name": "Hunter Failure Applicant",
                "applicant_email": "hunter.failure@example.com",
                "loan_type": "personal",
            },
        )

    with SessionLocal() as db:
        assert db.query(Application).filter_by(tenant_id=tenant_id, reference_code="HUNTER-FAILURE").count() == 0
        assert db.query(AuditLog).filter_by(tenant_id=tenant_id, action="application_created").count() == 0