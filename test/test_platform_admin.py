import uuid
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from app.db.database import (
    SessionLocal,
    migrate_sqlite_tenant_schema,
    migrate_sqlite_user_schema,
)
from app.db.models import PlatformAuditLog, Role, Tenant, User
from app.main import app
from app.services.auth_service import (
    create_platform_admin_user,
    create_session_token,
    hash_password,
)

client = TestClient(app)


def _register_tenant(prefix: str) -> dict:
    org_name = f"{prefix} {uuid.uuid4().hex[:8]}"
    email = f"{prefix.lower().replace(' ', '_')}_{uuid.uuid4().hex[:8]}@example.com"
    response = client.post(
        "/api/v1/auth/register",
        json={
            "organization_name": org_name,
            "name": "Tenant Admin",
            "email": email,
            "password": "SecurePass123",
            "confirm_password": "SecurePass123",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _create_platform_admin(tenant_id: str | None = None) -> tuple[str, str]:
    email = f"platform_{uuid.uuid4().hex[:8]}@example.com"
    session = SessionLocal()
    try:
        platform_admin = create_platform_admin_user(
            session,
            full_name="Platform Admin",
            email=email,
            password="SecurePass123",
            tenant_id=tenant_id,
        )
        session.commit()
        return create_session_token(platform_admin, role_name="Super Admin"), platform_admin.id
    finally:
        session.close()


def test_platform_admin_can_list_registered_tenants():
    tenants = [_register_tenant("Platform List A"), _register_tenant("Platform List B")]
    platform_email = f"platform_{uuid.uuid4().hex[:8]}@example.com"
    placeholder_email = f"platform_placeholder_{uuid.uuid4().hex[:8]}@example.com"

    session = SessionLocal()
    try:
        platform_admin = create_platform_admin_user(
            session,
            full_name="Platform Admin",
            email=platform_email,
            password="SecurePass123",
            tenant_id=tenants[0]["tenant"]["id"],
        )
        create_platform_admin_user(
            session,
            full_name="Platform Admin Placeholder",
            email=placeholder_email,
            password="SecurePass123",
        )
        session.commit()
        token = create_session_token(platform_admin, role_name="Super Admin")
    finally:
        session.close()

    response = client.get("/api/v1/platform-admin/tenants", headers=_headers(token))

    assert response.status_code == 200, response.text
    listed = response.json()
    listed_by_id = {tenant["id"]: tenant for tenant in listed}
    for tenant in tenants:
        tenant_id = tenant["tenant"]["id"]
        assert tenant_id in listed_by_id
        assert listed_by_id[tenant_id]["organization_name"] == tenant["tenant"]["organization_name"]
        assert set(listed_by_id[tenant_id]) == {
            "id",
            "organization_name",
            "status",
            "verification_status",
            "registration_number",
            "verification_reviewed_at",
            "verification_reviewer_id",
            "verification_reason",
            "created_at",
        }
        assert listed_by_id[tenant_id]["verification_status"] == "PENDING"
        assert listed_by_id[tenant_id]["status"] == "active"
    assert all(item["organization_name"] != "Platform Administration" for item in listed)


def test_new_tenant_verification_defaults_do_not_change_account_status():
    tenant_response = _register_tenant("Verification Defaults")

    session = SessionLocal()
    try:
        tenant = session.get(Tenant, tenant_response["tenant"]["id"])
        assert tenant is not None
        assert tenant.verification_status == "PENDING"
        assert tenant.status == "active"
        assert tenant.registration_number is None
        assert tenant.verification_reviewed_at is None
        assert tenant.verification_reviewer_id is None
        assert tenant.verification_reason is None
    finally:
        session.close()


def test_tenant_verification_migration_preserves_existing_records():
    engine = create_engine("sqlite://", future=True)
    try:
        with engine.begin() as connection:
            connection.exec_driver_sql(
                """
                CREATE TABLE tenants (
                    id VARCHAR(64) PRIMARY KEY,
                    organization_name VARCHAR(255) NOT NULL,
                    status VARCHAR(32) NOT NULL,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL
                )
                """
            )
            connection.exec_driver_sql(
                """
                INSERT INTO tenants (id, organization_name, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                ("TEN-LEGACY", "Legacy Organization", "inactive", "2024-01-01", "2024-01-02"),
            )

        migrate_sqlite_tenant_schema(engine)

        with engine.connect() as connection:
            legacy_tenant = connection.exec_driver_sql(
                """
                SELECT id, organization_name, status, verification_status, registration_number,
                       verification_reviewed_at, verification_reviewer_id, verification_reason
                FROM tenants WHERE id = ?
                """,
                ("TEN-LEGACY",),
            ).one()
        assert legacy_tenant == (
            "TEN-LEGACY",
            "Legacy Organization",
            "inactive",
            "PENDING",
            None,
            None,
            None,
            None,
        )
    finally:
        engine.dispose()


def test_user_platform_admin_migration_preserves_rows_and_is_idempotent():
    engine = create_engine("sqlite://", future=True)
    try:
        with engine.begin() as connection:
            connection.exec_driver_sql(
                """
                CREATE TABLE users (
                    id VARCHAR(64) PRIMARY KEY,
                    email VARCHAR(255) NOT NULL,
                    status VARCHAR(32) NOT NULL
                )
                """
            )
            connection.exec_driver_sql(
                "INSERT INTO users (id, email, status) VALUES (?, ?, ?)",
                ("USR-LEGACY", "legacy@example.com", "active"),
            )

        migrate_sqlite_user_schema(engine)
        migrate_sqlite_user_schema(engine)

        with engine.connect() as connection:
            columns = {
                row[1]
                for row in connection.exec_driver_sql("PRAGMA table_info(users)").fetchall()
            }
            legacy_user = connection.exec_driver_sql(
                "SELECT id, email, status, is_platform_admin FROM users WHERE id = ?",
                ("USR-LEGACY",),
            ).one()

        assert "is_platform_admin" in columns
        assert legacy_user == ("USR-LEGACY", "legacy@example.com", "active", 0)
    finally:
        engine.dispose()


def test_tenant_admin_cannot_list_global_tenants():
    tenant = _register_tenant("Tenant Admin Denied")

    response = client.get(
        "/api/v1/platform-admin/tenants",
        headers=_headers(tenant["token"]),
    )

    assert response.status_code == 403, response.text


def test_non_admin_tenant_user_cannot_list_global_tenants():
    tenant = _register_tenant("Tenant Member Denied")
    email = f"member_{uuid.uuid4().hex[:8]}@example.com"

    session = SessionLocal()
    try:
        role = Role(
            tenant_id=tenant["tenant"]["id"],
            name="Operations Reviewer",
            description="Tenant reviewer",
        )
        session.add(role)
        session.flush()
        session.add(
            User(
                tenant_id=tenant["tenant"]["id"],
                name="Tenant Reviewer",
                email=email,
                password_hash=hash_password("SecurePass123"),
                status="active",
                primary_role_id=role.id,
            )
        )
        session.commit()
    finally:
        session.close()

    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "SecurePass123"},
    )
    assert login.status_code == 200, login.text

    response = client.get(
        "/api/v1/platform-admin/tenants",
        headers=_headers(login.json()["token"]),
    )

    assert response.status_code == 403, response.text


def test_tenant_admin_scoped_endpoint_remains_tenant_scoped():
    tenant_a = _register_tenant("Scoped A")
    tenant_b = _register_tenant("Scoped B")

    response_a = client.get(
        "/api/v1/admin/users",
        headers=_headers(tenant_a["token"]),
    )
    response_b = client.get(
        "/api/v1/admin/users",
        headers=_headers(tenant_b["token"]),
    )

    assert response_a.status_code == 200, response_a.text
    assert response_b.status_code == 200, response_b.text
    assert all(user["tenant_id"] == tenant_a["tenant"]["id"] for user in response_a.json())
    assert all(user["tenant_id"] == tenant_b["tenant"]["id"] for user in response_b.json())


def test_platform_admin_verification_transitions_do_not_change_account_status():
    registered = _register_tenant("Verification Transitions")
    tenant_id = registered["tenant"]["id"]
    token, reviewer_id = _create_platform_admin()

    session = SessionLocal()
    try:
        tenant = session.get(Tenant, tenant_id)
        assert tenant is not None
        tenant.status = "inactive"
        session.commit()
    finally:
        session.close()

    headers = _headers(token)
    details = client.get(f"/api/v1/platform-admin/tenants/{tenant_id}/verification", headers=headers)
    assert details.status_code == 200, details.text
    assert details.json()["verification_status"] == "PENDING"

    under_review = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/verification/review",
        headers=headers,
    )
    assert under_review.status_code == 200, under_review.text
    assert under_review.json()["verification_status"] == "UNDER_REVIEW"
    assert under_review.json()["verification_reviewer_id"] == reviewer_id
    assert under_review.json()["verification_reviewed_at"] is not None

    requested = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/verification/request-information",
        headers=headers,
        json={"reason": "Please provide an incorporation certificate."},
    )
    assert requested.status_code == 200, requested.text
    assert requested.json()["verification_status"] == "INFORMATION_REQUIRED"
    assert requested.json()["verification_reason"] == "Please provide an incorporation certificate."

    re_review = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/verification/review",
        headers=headers,
    )
    assert re_review.status_code == 200, re_review.text
    assert re_review.json()["verification_reason"] is None

    approved = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/verification/approve",
        headers=headers,
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["verification_status"] == "VERIFIED"
    assert approved.json()["verification_reviewer_id"] == reviewer_id
    assert approved.json()["verification_reviewed_at"] is not None
    assert approved.json()["status"] == "inactive"

    session = SessionLocal()
    try:
        tenant = session.get(Tenant, tenant_id)
        assert tenant is not None
        assert tenant.status == "inactive"
        assert tenant.verification_status == "VERIFIED"
    finally:
        session.close()


def test_verification_rejection_requires_reason():
    registered = _register_tenant("Verification Reject")
    tenant_id = registered["tenant"]["id"]
    token, _ = _create_platform_admin()
    headers = _headers(token)

    started = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/verification/review",
        headers=headers,
    )
    assert started.status_code == 200, started.text

    missing_reason = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/verification/reject",
        headers=headers,
        json={},
    )
    blank_reason = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/verification/reject",
        headers=headers,
        json={"reason": "   "},
    )
    assert missing_reason.status_code == 422
    assert blank_reason.status_code == 422

    rejected = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/verification/reject",
        headers=headers,
        json={"reason": "Registration number could not be verified."},
    )
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["verification_status"] == "REJECTED"
    assert rejected.json()["verification_reason"] == "Registration number could not be verified."
    assert rejected.json()["verification_reviewer_id"] is not None
    assert rejected.json()["verification_reviewed_at"] is not None


def test_verification_rejects_invalid_transitions_and_unknown_tenants():
    registered = _register_tenant("Verification Invalid")
    tenant_id = registered["tenant"]["id"]
    token, _ = _create_platform_admin()
    headers = _headers(token)

    approve_pending = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/verification/approve",
        headers=headers,
    )
    assert approve_pending.status_code == 409, approve_pending.text

    start_review = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/verification/review",
        headers=headers,
    )
    assert start_review.status_code == 200, start_review.text
    duplicate_review = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/verification/review",
        headers=headers,
    )
    assert duplicate_review.status_code == 409, duplicate_review.text

    unknown = client.get(
        "/api/v1/platform-admin/tenants/NOT-A-TENANT/verification",
        headers=headers,
    )
    assert unknown.status_code == 404, unknown.text


def test_tenant_user_is_denied_verification_workflow_endpoints():
    registered = _register_tenant("Verification Unauthorized")
    tenant_id = registered["tenant"]["id"]
    headers = _headers(registered["token"])
    base_path = f"/api/v1/platform-admin/tenants/{tenant_id}/verification"

    responses = [
        client.get(base_path, headers=headers),
        client.post(f"{base_path}/review", headers=headers),
        client.post(f"{base_path}/approve", headers=headers),
        client.post(f"{base_path}/reject", headers=headers, json={"reason": "No"}),
        client.post(
            f"{base_path}/request-information",
            headers=headers,
            json={"reason": "More information required."},
        ),
    ]

    assert [response.status_code for response in responses] == [403, 403, 403, 403, 403]


def test_unverified_tenant_cannot_be_activated():
    registered = _register_tenant("Activation Unverified")
    tenant_id = registered["tenant"]["id"]
    token, _ = _create_platform_admin()

    session = SessionLocal()
    try:
        tenant = session.get(Tenant, tenant_id)
        assert tenant is not None
        tenant.status = "inactive"
        session.commit()
    finally:
        session.close()

    response = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/activate",
        headers=_headers(token),
    )

    assert response.status_code == 409, response.text
    session = SessionLocal()
    try:
        tenant = session.get(Tenant, tenant_id)
        assert tenant is not None
        assert tenant.status == "inactive"
    finally:
        session.close()


def test_verified_tenant_can_be_activated_without_changing_verification_history():
    registered = _register_tenant("Activation Verified")
    tenant_id = registered["tenant"]["id"]
    token, _ = _create_platform_admin()
    headers = _headers(token)

    session = SessionLocal()
    try:
        tenant = session.get(Tenant, tenant_id)
        assert tenant is not None
        tenant.status = "inactive"
        tenant.verification_status = "VERIFIED"
        tenant.verification_reason = None
        session.commit()
    finally:
        session.close()

    response = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/activate",
        headers=headers,
    )

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "active"
    assert response.json()["verification_status"] == "VERIFIED"


def test_deactivation_blocks_existing_and_new_tenant_sessions():
    registered = _register_tenant("Deactivation Block")
    tenant_id = registered["tenant"]["id"]
    token, _ = _create_platform_admin()

    session = SessionLocal()
    try:
        tenant = session.get(Tenant, tenant_id)
        assert tenant is not None
        tenant.verification_status = "VERIFIED"
        tenant.verification_reviewed_at = tenant.created_at
        tenant.verification_reason = "Previously reviewed."
        session.commit()
        verification_history = (
            tenant.verification_status,
            tenant.verification_reviewed_at,
            tenant.verification_reason,
        )
    finally:
        session.close()

    response = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/deactivate",
        headers=_headers(token),
    )

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "inactive"
    assert response.json()["verification_status"] == "VERIFIED"
    blocked_existing_session = client.get(
        "/api/v1/auth/me",
        headers=_headers(registered["token"]),
    )
    blocked_login = client.post(
        "/api/v1/auth/login",
        json={
            "email": registered["user"]["email"],
            "password": "SecurePass123",
        },
    )
    assert blocked_existing_session.status_code == 403, blocked_existing_session.text
    assert blocked_login.status_code == 403, blocked_login.text

    session = SessionLocal()
    try:
        tenant = session.get(Tenant, tenant_id)
        assert tenant is not None
        assert tenant.status == "inactive"
        assert (
            tenant.verification_status,
            tenant.verification_reviewed_at,
            tenant.verification_reason,
        ) == verification_history
    finally:
        session.close()


def test_tenant_user_cannot_activate_or_deactivate_tenant():
    registered = _register_tenant("Account Status Unauthorized")
    tenant_id = registered["tenant"]["id"]
    headers = _headers(registered["token"])

    activate = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/activate",
        headers=headers,
    )
    deactivate = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/deactivate",
        headers=headers,
    )

    assert activate.status_code == 403, activate.text
    assert deactivate.status_code == 403, deactivate.text


def test_account_status_endpoints_reject_invalid_transitions_and_tenant_ids():
    registered = _register_tenant("Account Status Invalid")
    tenant_id = registered["tenant"]["id"]
    token, _ = _create_platform_admin()
    headers = _headers(token)

    first_deactivation = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/deactivate",
        headers=headers,
    )
    assert first_deactivation.status_code == 200, first_deactivation.text

    already_inactive = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/deactivate",
        headers=headers,
    )
    assert already_inactive.status_code == 409, already_inactive.text

    unknown = client.post(
        "/api/v1/platform-admin/tenants/NOT-A-TENANT/deactivate",
        headers=headers,
    )
    assert unknown.status_code == 404, unknown.text


def test_platform_admin_actions_are_audited_and_hidden_from_tenant_audit():
    registered = _register_tenant("Platform Activity")
    tenant_id = registered["tenant"]["id"]
    token, actor_id = _create_platform_admin()
    headers = _headers(token)

    review = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/verification/review",
        headers=headers,
    )
    assert review.status_code == 200, review.text
    approve = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/verification/approve",
        headers=headers,
    )
    assert approve.status_code == 200, approve.text

    tenant_audit = client.get(
        "/api/v1/admin/audit",
        headers=_headers(registered["token"]),
    )
    assert tenant_audit.status_code == 200, tenant_audit.text
    assert all(
        not item["action"].startswith("tenant_verification_")
        for item in tenant_audit.json()
    )

    deactivate = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/deactivate",
        headers=headers,
    )
    assert deactivate.status_code == 200, deactivate.text
    activate = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/activate",
        headers=headers,
    )
    assert activate.status_code == 200, activate.text

    session = SessionLocal()
    try:
        events = (
            session.query(PlatformAuditLog)
            .filter(PlatformAuditLog.tenant_id == tenant_id)
            .all()
        )
        assert {event.action for event in events} == {
            "tenant_verification_review_started",
            "tenant_verification_approved",
            "tenant_deactivated",
            "tenant_activated",
        }
        assert all(event.actor_user_id == actor_id for event in events)
        assert all(event.resource_type == "tenant" for event in events)
        assert all(event.resource_id == tenant_id for event in events)
        status_events = {event.action: event.metadata_data for event in events}
        assert status_events["tenant_verification_approved"] == {
            "status_type": "verification",
            "previous_status": "UNDER_REVIEW",
            "new_status": "VERIFIED",
        }
        assert status_events["tenant_deactivated"] == {
            "status_type": "account",
            "previous_status": "active",
            "new_status": "inactive",
        }
    finally:
        session.close()


def test_rejection_reason_is_recorded_in_platform_activity():
    registered = _register_tenant("Platform Rejection Audit")
    tenant_id = registered["tenant"]["id"]
    token, actor_id = _create_platform_admin()
    headers = _headers(token)

    review = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/verification/review",
        headers=headers,
    )
    assert review.status_code == 200, review.text
    rejection = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/verification/reject",
        headers=headers,
        json={"reason": "Registration evidence could not be verified."},
    )
    assert rejection.status_code == 200, rejection.text

    session = SessionLocal()
    try:
        event = (
            session.query(PlatformAuditLog)
            .filter(
                PlatformAuditLog.tenant_id == tenant_id,
                PlatformAuditLog.action == "tenant_verification_rejected",
            )
            .one()
        )
        assert event.actor_user_id == actor_id
        assert event.metadata_data["previous_status"] == "UNDER_REVIEW"
        assert event.metadata_data["new_status"] == "REJECTED"
        assert event.metadata_data["reason"] == "Registration evidence could not be verified."
    finally:
        session.close()


def test_platform_activity_access_and_newest_first_pagination():
    registered = _register_tenant("Platform Activity Pagination")
    tenant_id = registered["tenant"]["id"]
    token, actor_id = _create_platform_admin()
    headers = _headers(token)
    created_at = datetime(2026, 10, 10, 12, 0, tzinfo=timezone.utc)
    event_prefix = f"PAUD-TEST-{uuid.uuid4().hex[:8]}"

    session = SessionLocal()
    try:
        session.add_all(
            [
                PlatformAuditLog(
                    id=f"{event_prefix}-{sequence}",
                    actor_user_id=actor_id,
                    tenant_id=tenant_id,
                    action=f"test_action_{sequence}",
                    resource_type="tenant",
                    resource_id=tenant_id,
                    timestamp=created_at,
                    metadata_data={},
                )
                for sequence in ("01", "02", "03")
            ]
        )
        session.commit()
    finally:
        session.close()

    denied = client.get(
        "/api/v1/platform-admin/activity",
        headers=_headers(registered["token"]),
    )
    assert denied.status_code == 403, denied.text
    oversized_page = client.get(
        "/api/v1/platform-admin/activity?limit=501",
        headers=headers,
    )
    assert oversized_page.status_code == 422, oversized_page.text

    first_page = client.get(
        "/api/v1/platform-admin/activity?limit=2",
        headers=headers,
    )
    second_page = client.get(
        "/api/v1/platform-admin/activity?limit=2&offset=2",
        headers=headers,
    )
    assert first_page.status_code == 200, first_page.text
    assert second_page.status_code == 200, second_page.text
    assert [event["id"] for event in first_page.json()] == [
        f"{event_prefix}-03",
        f"{event_prefix}-02",
    ]
    assert [event["id"] for event in second_page.json()] == [f"{event_prefix}-01"]
