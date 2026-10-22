from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.db.models import User, utcnow
from app.main import app
from app.services.auth_service import create_platform_admin_user, create_session_token

client = TestClient(app)


def _register_organization() -> dict:
    suffix = uuid.uuid4().hex[:10]
    response = client.post(
        "/api/v1/auth/register",
        json={
            "organization_name": f"Approval Gate {suffix}",
            "name": "Organization Admin",
            "email": f"approval_{suffix}@example.com",
            "password": "SecurePass123",
            "confirm_password": "SecurePass123",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def _platform_admin_headers() -> dict[str, str]:
    with SessionLocal() as db:
        user = create_platform_admin_user(
            db,
            full_name="Approval Gate Platform Admin",
            email=f"platform_{uuid.uuid4().hex[:10]}@example.com",
            password="SecurePass123",
            phone_number="+15555550100",
            phone_verified_at=utcnow(),
        )
        db.commit()
        token = create_session_token(user, role_name="Super Admin")
    return {"Authorization": f"Bearer {token}"}


def _approve(tenant_id: str, headers: dict[str, str]) -> None:
    reviewed = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/verification/review",
        headers=headers,
    )
    assert reviewed.status_code == 200, reviewed.text
    approved = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/verification/approve",
        headers=headers,
    )
    assert approved.status_code == 200, approved.text


def _tenant_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _governance_request(tenant_id: str) -> dict:
    return {
        "tenant_id": tenant_id,
        "features": {},
        "prediction": {"label": "approve", "probability": 0.5},
    }


def test_registration_and_identity_keep_authoritative_pending_status():
    registration = _register_organization()
    tenant = registration["tenant"]

    assert tenant["verification_status"] == "PENDING"
    assert tenant["status"] == "active"
    assert tenant["created_at"]
    assert registration["user"]["verification_status"] == "PENDING"
    assert registration["user"]["tenant_status"] == "active"

    identity = client.get(
        "/api/v1/auth/me",
        headers=_tenant_headers(registration["token"]),
    )
    assert identity.status_code == 200, identity.text
    assert identity.json()["verification_status"] == "PENDING"
    assert identity.json()["tenant_status"] == "active"
    assert identity.json()["tenant_created_at"]

    refreshed = client.post(
        "/api/v1/auth/refresh",
        headers=_tenant_headers(registration["token"]),
    )
    assert refreshed.status_code == 200, refreshed.text
    assert refreshed.json()["user"]["verification_status"] == "PENDING"


def test_pending_organization_cannot_use_tenant_apis_or_claim_another_tenant():
    registration = _register_organization()
    headers = _tenant_headers(registration["token"])

    dashboard = client.get("/api/v1/admin/organization", headers=headers)
    assert dashboard.status_code == 403, dashboard.text
    assert "verification_status=PENDING" in dashboard.json()["detail"]

    lending = client.post(
        "/api/v1/applications",
        headers=headers,
        json={"reference_code": "PENDING-1", "applicant_name": "Applicant"},
    )
    assert lending.status_code == 403, lending.text

    governance = client.post(
        "/api/v1/governance/evaluate",
        headers=headers,
        json=_governance_request("TEN-USER-SUPPLIED"),
    )
    assert governance.status_code == 403, governance.text


def test_platform_admin_can_review_pending_tenant_then_approved_admin_can_access():
    registration = _register_organization()
    admin_headers = _platform_admin_headers()
    tenant_id = registration["tenant"]["id"]

    queue = client.get("/api/v1/platform-admin/tenants", headers=admin_headers)
    assert queue.status_code == 200, queue.text
    assert any(
        tenant["id"] == tenant_id and tenant["verification_status"] == "PENDING"
        for tenant in queue.json()
    )

    _approve(tenant_id, admin_headers)
    dashboard = client.get(
        "/api/v1/admin/organization",
        headers=_tenant_headers(registration["token"]),
    )
    assert dashboard.status_code == 200, dashboard.text

    mismatched_governance = client.post(
        "/api/v1/governance/evaluate",
        headers=_tenant_headers(registration["token"]),
        json=_governance_request("TEN-USER-SUPPLIED"),
    )
    assert mismatched_governance.status_code == 403, mismatched_governance.text


def test_rejected_and_information_required_organizations_remain_blocked():
    admin_headers = _platform_admin_headers()

    rejected_registration = _register_organization()
    rejected_id = rejected_registration["tenant"]["id"]
    reviewed = client.post(
        f"/api/v1/platform-admin/tenants/{rejected_id}/verification/review",
        headers=admin_headers,
    )
    assert reviewed.status_code == 200, reviewed.text
    rejected = client.post(
        f"/api/v1/platform-admin/tenants/{rejected_id}/verification/reject",
        headers=admin_headers,
        json={"reason": "Registration documents could not be verified."},
    )
    assert rejected.status_code == 200, rejected.text

    info_registration = _register_organization()
    info_id = info_registration["tenant"]["id"]
    reviewed_info = client.post(
        f"/api/v1/platform-admin/tenants/{info_id}/verification/review",
        headers=admin_headers,
    )
    assert reviewed_info.status_code == 200, reviewed_info.text
    requested = client.post(
        f"/api/v1/platform-admin/tenants/{info_id}/verification/request-information",
        headers=admin_headers,
        json={"reason": "Please provide an updated registration certificate."},
    )
    assert requested.status_code == 200, requested.text

    for registration, expected_status in (
        (rejected_registration, "REJECTED"),
        (info_registration, "INFORMATION_REQUIRED"),
    ):
        login = client.post(
            "/api/v1/auth/login",
            json={
                "email": registration["user"]["email"],
                "password": "SecurePass123",
            },
        )
        assert login.status_code == 200, login.text
        assert login.json()["user"]["verification_status"] == expected_status
        response = client.get(
            "/api/v1/admin/organization",
            headers=_tenant_headers(login.json()["token"]),
        )
        assert response.status_code == 403, response.text


def test_deactivated_tenant_is_blocked_but_status_remains_available():
    registration = _register_organization()
    admin_headers = _platform_admin_headers()
    tenant_id = registration["tenant"]["id"]
    _approve(tenant_id, admin_headers)

    deactivated = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/deactivate",
        headers=admin_headers,
    )
    assert deactivated.status_code == 200, deactivated.text

    login = client.post(
        "/api/v1/auth/login",
        json={
            "email": registration["user"]["email"],
            "password": "SecurePass123",
        },
    )
    assert login.status_code == 200, login.text
    assert login.json()["user"]["tenant_status"] == "inactive"

    blocked = client.get(
        "/api/v1/admin/organization",
        headers=_tenant_headers(login.json()["token"]),
    )
    assert blocked.status_code == 403, blocked.text
    assert "inactive" in blocked.json()["detail"].lower()


def test_platform_admin_can_access_queue_even_when_its_own_tenant_is_not_verified():
    with SessionLocal() as db:
        admin_id = create_platform_admin_user(
            db,
            full_name="Pending Tenant Platform Admin",
            email=f"platform_pending_{uuid.uuid4().hex[:10]}@example.com",
            password="SecurePass123",
            phone_number="+15555550100",
            phone_verified_at=utcnow(),
        ).id
        admin = db.get(User, admin_id)
        assert admin is not None
        db.commit()
        admin_token = create_session_token(admin, role_name="Super Admin")
        admin_headers = _tenant_headers(admin_token)

    response = client.get("/api/v1/platform-admin/tenants", headers=admin_headers)
    assert response.status_code == 200, response.text
