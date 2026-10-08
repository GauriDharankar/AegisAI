import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _register_tenant(prefix: str) -> dict:
    org_name = f"{prefix} {uuid.uuid4().hex[:8]}"
    email = f"{prefix.lower()}_{uuid.uuid4().hex[:8]}@example.com"
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


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_tenant_admins_only_see_their_own_users():
    tenant_a = _register_tenant("TenantA")
    tenant_b = _register_tenant("TenantB")

    a_users = client.get("/api/v1/admin/users", headers=_auth_headers(tenant_a["token"]))
    assert a_users.status_code == 200, a_users.text
    a_payload = a_users.json()
    assert a_payload
    assert all(item["tenant_id"] == tenant_a["tenant"]["id"] for item in a_payload)

    b_users = client.get("/api/v1/admin/users", headers=_auth_headers(tenant_b["token"]))
    assert b_users.status_code == 200, b_users.text
    b_payload = b_users.json()
    assert all(item["tenant_id"] == tenant_b["tenant"]["id"] for item in b_payload)

    assert {item["id"] for item in a_payload}.isdisjoint({item["id"] for item in b_payload})


def test_admin_can_manage_organization_and_teams():
    tenant = _register_tenant("Org")

    org_get = client.get("/api/v1/admin/organization", headers=_auth_headers(tenant["token"]))
    assert org_get.status_code == 200, org_get.text
    assert org_get.json()["id"] == tenant["tenant"]["id"]

    update = client.put(
        "/api/v1/admin/organization",
        headers=_auth_headers(tenant["token"]),
        json={"organization_name": "Updated Org Name", "status": "active"},
    )
    assert update.status_code == 200, update.text
    assert update.json()["organization_name"] == "Updated Org Name"

    teams = client.get("/api/v1/admin/teams", headers=_auth_headers(tenant["token"]))
    assert teams.status_code == 200, teams.text
    team_payload = teams.json()
    assert team_payload

    created = client.post(
        "/api/v1/admin/teams",
        headers=_auth_headers(tenant["token"]),
        json={"name": "Operations Team Extra", "description": "Ops", "status": "active"},
    )
    assert created.status_code == 200, created.text
    assert created.json()["name"] == "Operations Team Extra"


def test_user_creation_is_tenant_scoped_and_rejects_invalid_responsibility():
    tenant = _register_tenant("Scoped")
    team_response = client.post(
        "/api/v1/admin/teams",
        headers=_auth_headers(tenant["token"]),
        json={"name": "Risk Team Extra", "description": "Risk", "status": "active"},
    )
    assert team_response.status_code == 200, team_response.text
    team_id = team_response.json()["id"]

    create_user = client.post(
        "/api/v1/admin/users",
        headers=_auth_headers(tenant["token"]),
        json={
            "name": "New Team Member",
            "email": f"member_{uuid.uuid4().hex[:8]}@example.com",
            "password": "SecurePass123",
            "status": "active",
            "team_ids": [team_id],
            "responsibilities": ["RISK_REVIEWER"],
            "tenant_id": "BAD-TENANT-ID",
        },
    )
    assert create_user.status_code == 200, create_user.text
    user_payload = create_user.json()
    assert user_payload["tenant_id"] == tenant["tenant"]["id"]
    assert user_payload["primary_role"] in {"Tenant Admin", "Operations Reviewer", "Risk Reviewer"}

    invalid_role = client.post(
        "/api/v1/admin/users",
        headers=_auth_headers(tenant["token"]),
        json={
            "name": "Bad Role User",
            "email": f"badrole_{uuid.uuid4().hex[:8]}@example.com",
            "password": "SecurePass123",
            "status": "active",
            "responsibilities": ["NOT_A_ROLE"],
        },
    )
    assert invalid_role.status_code == 400, invalid_role.text


def test_cross_tenant_resource_access_is_rejected():
    tenant_a = _register_tenant("A")
    tenant_b = _register_tenant("B")

    team_b = client.post(
        "/api/v1/admin/teams",
        headers=_auth_headers(tenant_b["token"]),
        json={"name": "Credit Committee Extra", "description": "Committee", "status": "active"},
    )
    team_b_id = team_b.json()["id"]

    user_list = client.get("/api/v1/admin/users", headers=_auth_headers(tenant_a["token"]))
    assert user_list.status_code == 200, user_list.text
    user_id = user_list.json()[0]["id"]

    bad_team_lookup = client.get(f"/api/v1/admin/teams/{team_b_id}/members", headers=_auth_headers(tenant_a["token"]))
    assert bad_team_lookup.status_code == 404, bad_team_lookup.text

    bad_user_lookup = client.get(f"/api/v1/admin/users/{user_id}", headers=_auth_headers(tenant_b["token"]))
    assert bad_user_lookup.status_code == 404, bad_user_lookup.text


def test_team_membership_and_status_controls_work():
    tenant = _register_tenant("Status")
    team = client.post(
        "/api/v1/admin/teams",
        headers=_auth_headers(tenant["token"]),
        json={"name": "Management", "description": "Leadership", "status": "active"},
    )
    assert team.status_code == 200, team.text
    team_id = team.json()["id"]

    new_user = client.post(
        "/api/v1/admin/users",
        headers=_auth_headers(tenant["token"]),
        json={
            "name": "Team Assign User",
            "email": f"assign_{uuid.uuid4().hex[:8]}@example.com",
            "password": "SecurePass123",
            "status": "active",
        },
    )
    assert new_user.status_code == 200, new_user.text
    member_id = new_user.json()["id"]

    assign = client.post(
        f"/api/v1/admin/users/{member_id}/teams",
        headers=_auth_headers(tenant["token"]),
        json={"team_id": team_id, "role": "OPERATIONS_REVIEWER"},
    )
    assert assign.status_code == 200, assign.text

    deactivate = client.patch(
        f"/api/v1/admin/users/{member_id}/status",
        headers=_auth_headers(tenant["token"]),
        json={"status": "inactive"},
    )
    assert deactivate.status_code == 200, deactivate.text

    login_attempt = client.post(
        "/api/v1/auth/login",
        json={"email": new_user.json()["email"], "password": "SecurePass123"},
    )
    assert login_attempt.status_code == 401, login_attempt.text


def test_admin_cannot_deactivate_themselves_and_inactive_users_cannot_log_in():
    tenant = _register_tenant("SelfProtect")

    self_deactivate = client.patch(
        f"/api/v1/admin/users/{tenant['user']['id']}/status",
        headers=_auth_headers(tenant["token"]),
        json={"status": "inactive"},
    )
    assert self_deactivate.status_code == 400, self_deactivate.text
    assert "Cannot deactivate your own currently active administrator account." in self_deactivate.json()["detail"]

    user = client.post(
        "/api/v1/admin/users",
        headers=_auth_headers(tenant["token"]),
        json={
            "name": "Inactive User",
            "email": f"inactive_{uuid.uuid4().hex[:8]}@example.com",
            "password": "SecurePass123",
            "status": "active",
        },
    )
    assert user.status_code == 200, user.text
    member_id = user.json()["id"]

    deactivate_member = client.patch(
        f"/api/v1/admin/users/{member_id}/status",
        headers=_auth_headers(tenant["token"]),
        json={"status": "inactive"},
    )
    assert deactivate_member.status_code == 200, deactivate_member.text

    login_attempt = client.post(
        "/api/v1/auth/login",
        json={"email": user.json()["email"], "password": "SecurePass123"},
    )
    assert login_attempt.status_code == 401, login_attempt.text
    assert "Your account is inactive" in login_attempt.json()["detail"]

    user_status = client.get("/api/v1/admin/users", headers=_auth_headers(tenant["token"]))
    assert user_status.status_code == 200, user_status.text
    assert next(item for item in user_status.json() if item["id"] == member_id)["status"] == "inactive"


def test_admin_can_activate_a_user_and_audit_events_are_recorded():
    tenant = _register_tenant("AuditLifecycle")

    created = client.post(
        "/api/v1/admin/users",
        headers=_auth_headers(tenant["token"]),
        json={
            "name": "Lifecycle User",
            "email": f"lifecycle_{uuid.uuid4().hex[:8]}@example.com",
            "password": "SecurePass123",
            "status": "active",
        },
    )
    member_id = created.json()["id"]

    deactivated = client.patch(
        f"/api/v1/admin/users/{member_id}/status",
        headers=_auth_headers(tenant["token"]),
        json={"status": "inactive"},
    )
    assert deactivated.status_code == 200, deactivated.text

    reactivated = client.patch(
        f"/api/v1/admin/users/{member_id}/status",
        headers=_auth_headers(tenant["token"]),
        json={"status": "active"},
    )
    assert reactivated.status_code == 200, reactivated.text
    assert reactivated.json()["status"] == "active"

    audit = client.get("/api/v1/admin/audit", headers=_auth_headers(tenant["token"]))
    assert audit.status_code == 200, audit.text
    actions = {item["action"] for item in audit.json()}
    assert "USER_DEACTIVATED" in actions
    assert "USER_ACTIVATED" in actions


def test_admin_can_change_responsibility_and_manage_multiple_teams():
    tenant = _register_tenant("Assignments")
    first_team = client.post(
        "/api/v1/admin/teams",
        headers=_auth_headers(tenant["token"]),
        json={"name": "Operations Assignment", "status": "active"},
    )
    second_team = client.post(
        "/api/v1/admin/teams",
        headers=_auth_headers(tenant["token"]),
        json={"name": "Risk Assignment", "status": "active"},
    )
    assert first_team.status_code == 200, first_team.text
    assert second_team.status_code == 200, second_team.text

    created = client.post(
        "/api/v1/admin/users",
        headers=_auth_headers(tenant["token"]),
        json={
            "name": "Assignment User",
            "email": f"assignment_{uuid.uuid4().hex[:8]}@example.com",
            "password": "SecurePass123",
        },
    )
    assert created.status_code == 200, created.text
    user_id = created.json()["id"]

    responsibility = client.post(
        f"/api/v1/admin/users/{user_id}/responsibilities",
        headers=_auth_headers(tenant["token"]),
        json={"responsibility": "RISK_REVIEWER"},
    )
    assert responsibility.status_code == 200, responsibility.text
    assert responsibility.json()["primary_role"] == "Risk Reviewer"

    for team_response in (first_team, second_team):
        assigned = client.post(
            f"/api/v1/admin/users/{user_id}/teams",
            headers=_auth_headers(tenant["token"]),
            json={"team_id": team_response.json()["id"]},
        )
        assert assigned.status_code == 200, assigned.text

    listed = client.get("/api/v1/admin/users", headers=_auth_headers(tenant["token"]))
    assert listed.status_code == 200, listed.text
    user = next(item for item in listed.json() if item["id"] == user_id)
    assert user["primary_role"] == "Risk Reviewer"
    assert {team["id"] for team in user["teams"]} == {first_team.json()["id"], second_team.json()["id"]}
    assert {team["role"] for team in user["teams"]} == {"Risk Reviewer"}

    update_team_role = client.post(
        f"/api/v1/admin/users/{user_id}/teams",
        headers=_auth_headers(tenant["token"]),
        json={"team_id": second_team.json()["id"], "role": "FINAL_DECISION_MAKER"},
    )
    assert update_team_role.status_code == 200, update_team_role.text

    role_refreshed = client.get(f"/api/v1/admin/users/{user_id}", headers=_auth_headers(tenant["token"]))
    assert role_refreshed.status_code == 200, role_refreshed.text
    team_roles = {team["id"]: team["role"] for team in role_refreshed.json()["teams"]}
    assert team_roles[first_team.json()["id"]] == "Risk Reviewer"
    assert team_roles[second_team.json()["id"]] == "Final Decision Maker"

    removed = client.delete(
        f"/api/v1/admin/users/{user_id}/teams/{first_team.json()['id']}",
        headers=_auth_headers(tenant["token"]),
    )
    assert removed.status_code == 200, removed.text

    refreshed = client.get(f"/api/v1/admin/users/{user_id}", headers=_auth_headers(tenant["token"]))
    assert refreshed.status_code == 200, refreshed.text
    assert [team["id"] for team in refreshed.json()["teams"]] == [second_team.json()["id"]]


def test_admin_audit_logs_are_tenant_scoped():
    tenant_a = _register_tenant("AuditA")
    tenant_b = _register_tenant("AuditB")

    update = client.put(
        "/api/v1/admin/organization",
        headers=_auth_headers(tenant_a["token"]),
        json={"organization_name": "Audit Organization A", "status": "active"},
    )
    assert update.status_code == 200, update.text

    audit_a = client.get("/api/v1/admin/audit", headers=_auth_headers(tenant_a["token"]))
    audit_b = client.get("/api/v1/admin/audit", headers=_auth_headers(tenant_b["token"]))
    assert audit_a.status_code == 200, audit_a.text
    assert audit_b.status_code == 200, audit_b.text
    assert all(item["tenant_id"] == tenant_a["tenant"]["id"] for item in audit_a.json())
    assert all(item["tenant_id"] == tenant_b["tenant"]["id"] for item in audit_b.json())
    assert any(item["action"] == "organization_registered" for item in audit_a.json())


def test_admin_audit_logs_never_return_another_tenant_event():
    tenant_a = _register_tenant("AuditIsolationA")
    tenant_b = _register_tenant("AuditIsolationB")

    update = client.put(
        "/api/v1/admin/organization",
        headers=_auth_headers(tenant_a["token"]),
        json={"organization_name": "Tenant A Only", "status": "active"},
    )
    assert update.status_code == 200, update.text

    audit_a = client.get("/api/v1/admin/audit", headers=_auth_headers(tenant_a["token"]))
    audit_b = client.get("/api/v1/admin/audit", headers=_auth_headers(tenant_b["token"]))
    assert audit_a.status_code == 200, audit_a.text
    assert audit_b.status_code == 200, audit_b.text

    audit_a_actions = {item["action"] for item in audit_a.json()}
    assert "organization_registered" in audit_a_actions
    assert all(item["tenant_id"] == tenant_a["tenant"]["id"] for item in audit_a.json())
    assert all(item["tenant_id"] == tenant_b["tenant"]["id"] for item in audit_b.json())
    assert all(item["resource_id"] != tenant_a["tenant"]["id"] for item in audit_b.json())


def test_reviewer_and_unauthenticated_users_are_rejected_for_admin_routes():
    tenant = _register_tenant("Review")

    reviewer = client.post(
        "/api/v1/admin/users",
        headers=_auth_headers(tenant["token"]),
        json={
            "name": "Reviewer User",
            "email": f"reviewer_{uuid.uuid4().hex[:8]}@example.com",
            "password": "SecurePass123",
            "status": "active",
            "responsibilities": ["OPERATIONS_REVIEWER"],
        },
    )
    assert reviewer.status_code == 200, reviewer.text
    reviewer_token = client.post(
        "/api/v1/auth/login",
        json={
            "email": reviewer.json()["email"],
            "password": "SecurePass123",
        },
    ).json()["token"]

    protected = client.get("/api/v1/admin/users", headers=_auth_headers(reviewer_token))
    assert protected.status_code == 403, protected.text

    no_auth = client.get("/api/v1/admin/users")
    assert no_auth.status_code == 401, no_auth.text
