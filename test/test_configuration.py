import uuid

from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.db.models import Tenant
from app.main import app


client = TestClient(app)


def _register(prefix: str) -> dict:
    email = f"{prefix.lower()}_{uuid.uuid4().hex[:8]}@example.com"
    password = "SecurePass123"
    response = client.post(
        "/api/v1/auth/register",
        json={
            "organization_name": f"{prefix} {uuid.uuid4().hex[:8]}",
            "name": "Configuration Admin",
            "email": email,
            "password": password,
            "confirm_password": password,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_configuration_save_reload_persists_all_auto_approval_values():
    tenant = _register("ConfigPersist")
    values = {
        "enabled": True,
        "minimum_probability": 0.92,
        "maximum_risk": "MEDIUM",
        "eligible_loan_types": ["personal", "auto"],
        "require_policy_compliance": False,
        "require_fairness_pass": True,
    }

    saved = client.put(
        "/api/v1/admin/configuration",
        headers=_headers(tenant["token"]),
        json={"auto_approve": values},
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["tenant_id"] == tenant["tenant"]["id"]
    assert saved.json()["auto_approve"] == values

    with SessionLocal() as db:
        stored_tenant = db.get(Tenant, tenant["tenant"]["id"])
        assert stored_tenant is not None
        assert stored_tenant.governance_configuration["auto_approve"] == values

    reloaded = client.get("/api/v1/admin/configuration", headers=_headers(tenant["token"]))
    assert reloaded.status_code == 200, reloaded.text
    assert reloaded.json()["auto_approve"] == values


def test_configuration_round_trip_persists_85_percent_as_normalized_probability():
    tenant = _register("ConfigProbability")
    values = {
        "enabled": True,
        "minimum_probability": 0.85,
        "maximum_risk": "LOW",
        "eligible_loan_types": [],
        "require_policy_compliance": True,
        "require_fairness_pass": True,
    }

    saved = client.put(
        "/api/v1/admin/configuration",
        headers=_headers(tenant["token"]),
        json={"auto_approve": values},
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["auto_approve"]["minimum_probability"] == 0.85

    reloaded = client.get("/api/v1/admin/configuration", headers=_headers(tenant["token"]))
    assert reloaded.status_code == 200, reloaded.text
    assert reloaded.json()["auto_approve"]["minimum_probability"] == 0.85


def test_configuration_is_tenant_isolated():
    tenant_a = _register("ConfigTenantA")
    tenant_b = _register("ConfigTenantB")
    values_a = {
        "enabled": True,
        "minimum_probability": 0.95,
        "maximum_risk": "HIGH",
        "eligible_loan_types": ["mortgage"],
        "require_policy_compliance": False,
        "require_fairness_pass": False,
    }

    saved = client.put(
        "/api/v1/admin/configuration",
        headers=_headers(tenant_a["token"]),
        json={"auto_approve": values_a},
    )
    assert saved.status_code == 200, saved.text

    tenant_b_configuration = client.get(
        "/api/v1/admin/configuration",
        headers=_headers(tenant_b["token"]),
    )
    assert tenant_b_configuration.status_code == 200, tenant_b_configuration.text
    assert tenant_b_configuration.json()["tenant_id"] == tenant_b["tenant"]["id"]
    assert tenant_b_configuration.json()["auto_approve"]["enabled"] is False
    assert tenant_b_configuration.json()["auto_approve"] != values_a


def test_application_governance_reads_persisted_tenant_configuration(monkeypatch):
    tenant = _register("ConfigGovernance")
    values = {
        "enabled": True,
        "minimum_probability": 0.99,
        "maximum_risk": "LOW",
        "eligible_loan_types": ["personal"],
        "require_policy_compliance": True,
        "require_fairness_pass": True,
    }
    saved = client.put(
        "/api/v1/admin/configuration",
        headers=_headers(tenant["token"]),
        json={"auto_approve": values},
    )
    assert saved.status_code == 200, saved.text

    from app.api.applications import ApplicationCreateRequest, _evaluate_application
    from app.services.governance_service import governance_service

    captured = {}

    def capture_evaluation(**kwargs):
        captured.update(kwargs)
        return {"routing": {"route": "HUMAN_REVIEW"}}

    monkeypatch.setattr(governance_service, "evaluate", capture_evaluation)

    with SessionLocal() as db:
        result = _evaluate_application(
            db,
            tenant["tenant"]["id"],
            ApplicationCreateRequest(
                reference_code="CONFIG-GOVERNANCE",
                applicant_name="Configuration Applicant",
                loan_type="personal",
            ),
        )

    assert result["routing"]["route"] == "HUMAN_REVIEW"
    assert captured["configuration"]["auto_approve"] == values
    assert captured["loan_type"] == "personal"
