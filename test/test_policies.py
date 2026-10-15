from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.database import SessionLocal
from app.db.models import AuditLog, Policy, PolicyVersion
from app.api.applications import _tenant_policy_rules
from app.main import app

client = TestClient(app)


def _register_tenant(prefix: str) -> dict:
    suffix = uuid.uuid4().hex[:8]
    response = client.post(
        "/api/v1/auth/register",
        json={
            "organization_name": f"{prefix} {suffix}",
            "name": "Policy Admin",
            "email": f"{prefix.lower()}_{suffix}@example.com",
            "password": "SecurePass123",
            "confirm_password": "SecurePass123",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _policy_payload(**overrides) -> dict:
    return {
        "name": "Minimum Credit Score",
        "description": "Require a minimum credit score.",
        "enabled": True,
        "field": "credit_score",
        "operator": ">=",
        "value": 650,
        "action": "REJECT",
        "severity": "HIGH",
        **overrides,
    }


def _create_policy(token: str, payload: dict | None = None) -> dict:
    response = client.post(
        "/api/v1/policies",
        headers=_headers(token),
        json=payload or _policy_payload(),
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_policy_create_persists_and_is_audited():
    tenant = _register_tenant("PolicyCreate")
    policy = _create_policy(tenant["token"])

    assert policy["name"] == "Minimum Credit Score"
    assert policy["version_number"] == 1
    assert policy["value"] == 650

    # A fresh list request, as after a page reload, reads the saved row and rule version.
    reloaded = client.get("/api/v1/policies", headers=_headers(tenant["token"]))
    assert reloaded.status_code == 200, reloaded.text
    assert [item["id"] for item in reloaded.json()] == [policy["id"]]
    assert reloaded.json()[0]["field"] == "credit_score"

    with SessionLocal() as db:
        stored = db.get(Policy, policy["id"])
        assert stored is not None
        assert stored.tenant_id == tenant["tenant"]["id"]
        assert db.execute(
            select(AuditLog).where(
                AuditLog.resource_id == policy["id"],
                AuditLog.action == "POLICY_CREATED",
            )
        ).scalar_one()


def test_policy_edit_appends_version_and_preserves_prior_rule():
    tenant = _register_tenant("PolicyEdit")
    policy = _create_policy(tenant["token"])
    updated = client.put(
        f"/api/v1/policies/{policy['id']}",
        headers=_headers(tenant["token"]),
        json=_policy_payload(value=700, description="Updated threshold."),
    )

    assert updated.status_code == 200, updated.text
    assert updated.json()["id"] == policy["id"]
    assert updated.json()["version_number"] == 2
    assert updated.json()["value"] == 700

    with SessionLocal() as db:
        versions = db.execute(
            select(PolicyVersion)
            .where(PolicyVersion.policy_id == policy["id"])
            .order_by(PolicyVersion.version_number)
        ).scalars().all()
        assert [version.version_number for version in versions] == [1, 2]
        assert versions[0].rule_definition["value"] == 650
        assert versions[1].rule_definition["value"] == 700
        rules_used_for_evaluation = _tenant_policy_rules(db, tenant["tenant"]["id"])
        assert len(rules_used_for_evaluation) == 1
        assert rules_used_for_evaluation[0]["value"] == 700

    reloaded = client.get("/api/v1/policies", headers=_headers(tenant["token"]))
    assert reloaded.json()[0]["value"] == 700


def test_policy_delete_removes_policy_and_versions_but_keeps_audit():
    tenant = _register_tenant("PolicyDelete")
    policy = _create_policy(tenant["token"])

    deleted = client.delete(
        f"/api/v1/policies/{policy['id']}",
        headers=_headers(tenant["token"]),
    )
    assert deleted.status_code == 204

    reloaded = client.get("/api/v1/policies", headers=_headers(tenant["token"]))
    assert reloaded.status_code == 200
    assert reloaded.json() == []

    with SessionLocal() as db:
        assert db.get(Policy, policy["id"]) is None
        assert db.execute(
            select(PolicyVersion).where(PolicyVersion.policy_id == policy["id"])
        ).scalars().all() == []
        assert db.execute(
            select(AuditLog).where(
                AuditLog.resource_id == policy["id"],
                AuditLog.action == "POLICY_DELETED",
            )
        ).scalar_one()


def test_policy_operations_cannot_cross_tenant_or_trust_payload_tenant_id():
    tenant_a = _register_tenant("PolicyTenantA")
    tenant_b = _register_tenant("PolicyTenantB")
    policy_a = _create_policy(tenant_a["token"])
    policy_b = _create_policy(tenant_b["token"], _policy_payload(name="Tenant B Rule"))

    list_a = client.get("/api/v1/policies", headers=_headers(tenant_a["token"]))
    list_b = client.get("/api/v1/policies", headers=_headers(tenant_b["token"]))
    assert [item["id"] for item in list_a.json()] == [policy_a["id"]]
    assert [item["id"] for item in list_b.json()] == [policy_b["id"]]

    denied_update = client.put(
        f"/api/v1/policies/{policy_b['id']}",
        headers=_headers(tenant_a["token"]),
        json=_policy_payload(name="Unauthorized edit"),
    )
    denied_delete = client.delete(
        f"/api/v1/policies/{policy_b['id']}",
        headers=_headers(tenant_a["token"]),
    )
    assert denied_update.status_code == 404
    assert denied_delete.status_code == 404

    forged_tenant = client.post(
        "/api/v1/policies",
        headers=_headers(tenant_a["token"]),
        json=_policy_payload(name="Forged tenant rule", tenant_id=tenant_b["tenant"]["id"]),
    )
    assert forged_tenant.status_code == 422

    unchanged_b = client.get("/api/v1/policies", headers=_headers(tenant_b["token"]))
    assert [item["id"] for item in unchanged_b.json()] == [policy_b["id"]]


def test_only_tenant_admins_can_change_policies():
    tenant = _register_tenant("PolicyPermissions")
    email = f"reviewer_{uuid.uuid4().hex[:8]}@example.com"
    created_user = client.post(
        "/api/v1/admin/users",
        headers=_headers(tenant["token"]),
        json={
            "name": "Policy Reviewer",
            "email": email,
            "password": "SecurePass123",
            "responsibilities": ["OPERATIONS_REVIEWER"],
        },
    )
    assert created_user.status_code == 200, created_user.text
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "SecurePass123"},
    )
    assert login.status_code == 200, login.text
    reviewer_headers = _headers(login.json()["token"])

    assert client.get("/api/v1/policies", headers=reviewer_headers).status_code == 200
    denied = client.post(
        "/api/v1/policies",
        headers=reviewer_headers,
        json=_policy_payload(),
    )
    assert denied.status_code == 403
