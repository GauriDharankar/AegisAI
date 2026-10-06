import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from app.api.applications import ApplicationCreateRequest, _evaluate_application
from app.db.database import SessionLocal, migrate_sqlite_application_schema
from app.db.models import AuditLog
from app.main import app
from app.services.financial_service import calculate_debt_to_income
from app.services.governance_service import governance_service
from app.services.policy_service import PolicyService

client = TestClient(app)


def test_debt_to_income_uses_monthly_values_and_handles_non_positive_income():
    assert calculate_debt_to_income(10000, 60000) == pytest.approx(1 / 6)
    assert calculate_debt_to_income(10000, 0) == 0.0
    assert calculate_debt_to_income(10000, -60000) == 0.0


def test_policy_evaluates_normalized_debt_to_income():
    result = PolicyService().check_compliance(
        features={"debt_to_income": calculate_debt_to_income(10000, 60000)},
        policies=[
            {
                "policy_id": "DTI-040",
                "name": "Debt-to-income limit",
                "field": "debt_to_income",
                "operator": "<=",
                "value": 0.40,
                "action": "REVIEW",
                "severity": "HIGH",
            }
        ],
    )

    assert result["checks"][0]["actual"] == pytest.approx(0.1667, abs=0.0001)
    assert result["checks"][0]["status"] == "pass"


def test_governance_receives_normalized_debt_to_income(monkeypatch):
    captured = {}
    _, tenant_id = _register_tenant("TenantDtiGovernance")

    def capture_evaluation(**kwargs):
        captured.update(kwargs)
        return {"decision": {"final_decision": "HUMAN_REVIEW"}}

    monkeypatch.setattr(governance_service, "evaluate", capture_evaluation)

    with SessionLocal() as db:
        _evaluate_application(
            db,
            tenant_id,
            ApplicationCreateRequest(
                reference_code="DTI-GOVERNANCE",
                applicant_name="DTI Applicant",
                monthly_income=60000,
                existing_monthly_emi=10000,
            ),
        )

    assert captured["features"]["debt_to_income"] == pytest.approx(0.1667, abs=0.0001)


def _unique_org_name(prefix: str = "App Org") -> str:
    return f"{prefix} {uuid.uuid4().hex[:8]}"


def _register_tenant(prefix: str = "App") -> tuple[str, str]:
    org_name = _unique_org_name(prefix)
    email = f"{prefix.lower()}_{uuid.uuid4().hex[:8]}@example.com"
    password = "SecurePass123"

    response = client.post(
        "/api/v1/auth/register",
        json={
            "organization_name": org_name,
            "name": "App Admin",
            "email": email,
            "password": password,
            "confirm_password": password,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["token"], response.json()["tenant"]["id"]


def _create_team(token: str, name: str) -> str:
    response = client.post(
        "/api/v1/admin/teams",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": name, "description": "Test team", "status": "active"},
    )
    assert response.status_code == 200, response.text
    return response.json()["id"]


def test_legacy_sqlite_application_schema_upgrade_adds_missing_columns_and_preserves_data():
    engine = create_engine("sqlite://", future=True)
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE tenants (id TEXT PRIMARY KEY, organization_name TEXT, status TEXT, created_at DATETIME, updated_at DATETIME)"
        )
        connection.exec_driver_sql(
            "CREATE TABLE governance_workflows (id TEXT PRIMARY KEY, tenant_id TEXT, name TEXT, status TEXT, created_at DATETIME, updated_at DATETIME)"
        )
        connection.exec_driver_sql(
            "CREATE TABLE workflow_stages (id TEXT PRIMARY KEY, workflow_id TEXT, stage_type TEXT, stage_order INTEGER, team_id TEXT, status TEXT, created_at DATETIME, updated_at DATETIME)"
        )
        connection.exec_driver_sql(
            "CREATE TABLE applications (id TEXT PRIMARY KEY, tenant_id TEXT, reference_code TEXT, applicant_name TEXT, status TEXT, created_at DATETIME, updated_at DATETIME)"
        )
        connection.exec_driver_sql(
            "INSERT INTO tenants (id, organization_name, status, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
            ("TEN-1", "Legacy Org", "active"),
        )
        connection.exec_driver_sql(
            "INSERT INTO governance_workflows (id, tenant_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
            ("GWF-1", "TEN-1", "Legacy Workflow", "active"),
        )
        connection.exec_driver_sql(
            "INSERT INTO workflow_stages (id, workflow_id, stage_type, stage_order, team_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
            ("WFS-1", "GWF-1", "OPERATIONS_REVIEW", 1, "TEAM-1", "active"),
        )
        connection.exec_driver_sql(
            "INSERT INTO applications (id, tenant_id, reference_code, applicant_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
            ("APP-LEGACY", "TEN-1", "APP-9001", "Legacy Applicant", "new"),
        )

    migrate_sqlite_application_schema(engine)

    with engine.begin() as connection:
        columns = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(applications)").fetchall()}
        assert "workflow_id" in columns
        assert "current_workflow_stage" in columns
        assert "current_workflow_stage_id" in columns
        assert "assigned_team_id" in columns
        row = connection.exec_driver_sql(
            "SELECT reference_code, workflow_id, current_workflow_stage, current_workflow_stage_id, assigned_team_id FROM applications WHERE id = ?",
            ("APP-LEGACY",),
        ).fetchone()
        assert row is not None
        assert row[0] == "APP-9001"
        assert row[1] == "GWF-1"
        assert row[2] == "OPERATIONS_REVIEW"
        assert row[3] == "WFS-1"
        assert row[4] == "TEAM-1"


def test_authenticated_user_can_create_application():
    token, _ = _register_tenant("TenantA")
    team_id = _create_team(token, "Applications Team")

    response = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "reference_code": "APP-1001",
            "applicant_name": "Alice Example",
            "applicant_email": "alice@example.com",
            "status": "new",
            "team_id": team_id,
        },
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["reference_code"] == "APP-1001"
    assert payload["applicant_name"] == "Alice Example"
    assert payload["tenant_id"]
    assert payload["workflow_id"]
    assert payload["current_workflow_stage"]
    assert payload["governance_status"] == "review_required"
    assert payload["governance_result"]["governance_id"].startswith("GOV-")
    assert payload["governance_result"]["risk"]["level"] in {"LOW", "MEDIUM", "HIGH"}
    assert payload["loan_amount"] == 300000
    assert payload["credit_score"] == 700


def test_application_is_persisted_in_sqlite():
    token, _ = _register_tenant("TenantPersist")
    team_id = _create_team(token, "Persist Team")

    response = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "reference_code": "APP-1002",
            "applicant_name": "Bob Example",
            "applicant_email": "bob@example.com",
            "team_id": team_id,
        },
    )
    assert response.status_code == 200, response.text
    app_id = response.json()["id"]

    list_response = client.get(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_response.status_code == 200, list_response.text
    app_ids = [item["id"] for item in list_response.json()]
    assert app_id in app_ids


def test_application_api_and_persistence_use_normalized_dti():
    token, tenant_id = _register_tenant("TenantDti")

    response = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "reference_code": "APP-DTI-001",
            "applicant_name": "DTI Example",
            "monthly_income": 60000,
            "existing_monthly_emi": 10000,
        },
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["debt_to_income"] == pytest.approx(0.1667, abs=0.0001)

    with SessionLocal() as db:
        from app.db.models import Application

        application = db.query(Application).filter_by(
            id=payload["id"],
            tenant_id=tenant_id,
        ).one()
        assert application.debt_to_income == pytest.approx(0.1667, abs=0.0001)


def test_authenticated_tenant_can_list_its_applications():
    token, _ = _register_tenant("TenantList")
    team_id = _create_team(token, "List Team")

    client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "reference_code": "APP-1003",
            "applicant_name": "Carol Example",
            "applicant_email": "carol@example.com",
            "team_id": team_id,
        },
    )

    response = client.get(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, response.text
    assert len(response.json()) == 1
    assert response.json()[0]["reference_code"] == "APP-1003"


def test_dashboard_application_source_is_tenant_scoped_and_returns_review_status():
    token_a, _ = _register_tenant("DashboardTenantA")
    token_b, _ = _register_tenant("DashboardTenantB")

    created = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "reference_code": "APP-DASHBOARD-A",
            "applicant_name": "Dashboard Applicant A",
        },
    )
    assert created.status_code == 200, created.text

    tenant_a_applications = client.get(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    tenant_b_applications = client.get(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token_b}"},
    )

    assert tenant_a_applications.status_code == 200, tenant_a_applications.text
    assert tenant_b_applications.status_code == 200, tenant_b_applications.text
    assert tenant_a_applications.json()[0]["status"] == "in_review"
    assert tenant_b_applications.json() == []


def test_authenticated_tenant_can_retrieve_its_application():
    token, _ = _register_tenant("TenantGet")
    team_id = _create_team(token, "Get Team")

    create_response = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "reference_code": "APP-1004",
            "applicant_name": "Dan Example",
            "applicant_email": "dan@example.com",
            "team_id": team_id,
        },
    )
    app_id = create_response.json()["id"]

    response = client.get(
        f"/api/v1/applications/{app_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["id"] == app_id
    assert response.json()["applicant_name"] == "Dan Example"


def test_tenant_a_cannot_retrieve_tenant_b_application():
    token_a, _ = _register_tenant("TenantA")
    token_b, _ = _register_tenant("TenantB")
    team_b_id = _create_team(token_b, "Tenant B Team")

    create_response = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token_b}"},
        json={
            "reference_code": "APP-1005",
            "applicant_name": "Eve Example",
            "applicant_email": "eve@example.com",
            "team_id": team_b_id,
        },
    )
    assert create_response.status_code == 200, create_response.text
    app_id = create_response.json()["id"]

    response = client.get(
        f"/api/v1/applications/{app_id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert response.status_code == 404, response.text


def test_tenant_a_cannot_list_tenant_b_applications():
    token_a, _ = _register_tenant("TenantAList")
    token_b, _ = _register_tenant("TenantBList")
    team_b_id = _create_team(token_b, "Other Team")

    client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token_b}"},
        json={
            "reference_code": "APP-1006",
            "applicant_name": "Frank Example",
            "applicant_email": "frank@example.com",
            "team_id": team_b_id,
        },
    )

    response = client.get(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert response.status_code == 200, response.text
    assert response.json() == []


def test_ai_governance_result_is_persisted_and_tenant_isolated():
    token_a, tenant_a = _register_tenant("GovernanceTenantA")
    token_b, tenant_b = _register_tenant("GovernanceTenantB")

    app_a = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "reference_code": "APP-GOV-A",
            "applicant_name": "Governed A",
            "loan_amount": 250000,
            "monthly_income": 90000,
            "credit_score": 780,
            "existing_monthly_emi": 5000,
        },
    )
    assert app_a.status_code == 200, app_a.text
    payload_a = app_a.json()
    assert payload_a["tenant_id"] == tenant_a
    assert payload_a["governance_result"]["tenant_id"] == tenant_a
    assert payload_a["governance_result"]["explainability"]["method"] == "SHAP"
    assert "policy_compliance" in payload_a["governance_result"]
    assert "fairness" in payload_a["governance_result"]

    app_b = client.get(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert app_b.status_code == 200, app_b.text
    assert app_b.json() == []

    cross_tenant = client.get(
        f"/api/v1/applications/{payload_a['id']}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert cross_tenant.status_code == 404, cross_tenant.text


def test_application_uses_authenticated_tenants_active_workflow_and_first_stage_team():
    token, _ = _register_tenant("WorkflowTenant")
    workflow_response = client.get(
        "/api/v1/admin/workflow",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert workflow_response.status_code == 200, workflow_response.text
    workflow = workflow_response.json()
    assert workflow["name"] == "Default Governance Workflow"
    assert workflow["stages"]
    first_stage = workflow["stages"][0]

    response = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "reference_code": "APP-2001",
            "applicant_name": "Grace Example",
            "applicant_email": "grace@example.com",
        },
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["workflow_id"] == workflow["id"]
    assert payload["current_workflow_stage"] == first_stage["stage_type"]
    assert payload["assigned_team_id"] == first_stage["team_id"]


def test_application_creation_fails_without_active_tenant_workflow():
    token, _ = _register_tenant("NoWorkflowTenant")
    workflow_response = client.get(
        "/api/v1/admin/workflow",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert workflow_response.status_code == 200, workflow_response.text
    workflow = workflow_response.json()
    team_id = workflow["stages"][0]["team_id"]

    update_response = client.put(
        "/api/v1/admin/workflow",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Disabled Workflow",
            "status": "inactive",
            "stages": [
                {
                    "stage_type": "OPERATIONS_REVIEW",
                    "team_id": team_id,
                    "status": "active",
                    "stage_order": 1,
                },
                {
                    "stage_type": "FINAL_DECISION",
                    "team_id": team_id,
                    "status": "active",
                    "stage_order": 2,
                },
            ],
        },
    )
    assert update_response.status_code == 200, update_response.text

    create_response = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "reference_code": "APP-2002",
            "applicant_name": "Heidi Example",
            "applicant_email": "heidi@example.com",
        },
    )
    assert create_response.status_code == 400, create_response.text
    assert "active governance workflow" in create_response.json()["detail"].lower()


def test_tenant_workflow_selection_is_isolated_per_tenant():
    token_a, _ = _register_tenant("TenantAWorkflow")
    token_b, _ = _register_tenant("TenantBWorkflow")

    team_b = _create_team(token_b, "Workflow Team B")
    workflow_b = client.put(
        "/api/v1/admin/workflow",
        headers={"Authorization": f"Bearer {token_b}"},
        json={
            "name": "Tenant B Workflow",
            "status": "active",
            "stages": [
                {"stage_type": "OPERATIONS_REVIEW", "team_id": team_b, "status": "active"},
                {"stage_type": "FINAL_DECISION", "team_id": team_b, "status": "active"},
            ],
        },
    )
    assert workflow_b.status_code == 200, workflow_b.text

    app_b = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token_b}"},
        json={
            "reference_code": "APP-2003",
            "applicant_name": "Ian Example",
            "applicant_email": "ian@example.com",
        },
    )
    assert app_b.status_code == 200, app_b.text
    assert app_b.json()["workflow_id"] == workflow_b.json()["id"]
    assert app_b.json()["current_workflow_stage"] == "OPERATIONS_REVIEW"

    app_a = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "reference_code": "APP-2004",
            "applicant_name": "Julia Example",
            "applicant_email": "julia@example.com",
        },
    )
    assert app_a.status_code == 200, app_a.text
    assert app_a.json()["workflow_id"] != workflow_b.json()["id"]
    assert app_a.json()["workflow_id"] != app_b.json()["workflow_id"]


def test_application_advances_to_next_configured_stage_and_team():
    token, _ = _register_tenant("TenantAdvance")
    team_ops = _create_team(token, f"Operations Team {uuid.uuid4().hex[:6]}")
    team_final = _create_team(token, f"Final Team {uuid.uuid4().hex[:6]}")

    workflow_response = client.put(
        "/api/v1/admin/workflow",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Advanced Workflow",
            "status": "active",
            "stages": [
                {"stage_type": "OPERATIONS_REVIEW", "team_id": team_ops, "status": "active", "stage_order": 1},
                {"stage_type": "FINAL_DECISION", "team_id": team_final, "status": "active", "stage_order": 2},
            ],
        },
    )
    assert workflow_response.status_code == 200, workflow_response.text
    workflow = workflow_response.json()

    app_response = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "reference_code": "APP-3001",
            "applicant_name": "Kelly Example",
            "applicant_email": "kelly@example.com",
        },
    )
    app_id = app_response.json()["id"]

    advance_response = client.post(
        f"/api/v1/applications/{app_id}/advance-stage",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert advance_response.status_code == 200, advance_response.text
    payload = advance_response.json()
    assert payload["current_workflow_stage"] == "FINAL_DECISION"
    assert payload["assigned_team_id"] == team_final
    assert payload["workflow_id"] == workflow["id"]


def test_application_uses_configured_stage_order_for_multiple_review_stages():
    token, _ = _register_tenant("TenantStageOrder")
    team_ops = _create_team(token, f"Ops Review Team {uuid.uuid4().hex[:6]}")
    team_risk = _create_team(token, f"Risk Review Team {uuid.uuid4().hex[:6]}")
    team_final = _create_team(token, f"Decision Team {uuid.uuid4().hex[:6]}")

    workflow_response = client.put(
        "/api/v1/admin/workflow",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Stage Ordered Workflow",
            "status": "active",
            "stages": [
                {"stage_type": "OPERATIONS_REVIEW", "team_id": team_ops, "status": "active", "stage_order": 1},
                {"stage_type": "RISK_REVIEW", "team_id": team_risk, "status": "active", "stage_order": 2},
                {"stage_type": "FINAL_DECISION", "team_id": team_final, "status": "active", "stage_order": 3},
            ],
        },
    )
    assert workflow_response.status_code == 200, workflow_response.text

    app_response = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "reference_code": "APP-3002",
            "applicant_name": "Lena Example",
            "applicant_email": "lena@example.com",
        },
    )
    app_id = app_response.json()["id"]

    first_advance = client.post(
        f"/api/v1/applications/{app_id}/advance-stage",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert first_advance.status_code == 200, first_advance.text
    assert first_advance.json()["current_workflow_stage"] == "RISK_REVIEW"
    assert first_advance.json()["assigned_team_id"] == team_risk

    second_advance = client.post(
        f"/api/v1/applications/{app_id}/advance-stage",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert second_advance.status_code == 200, second_advance.text
    assert second_advance.json()["current_workflow_stage"] == "FINAL_DECISION"
    assert second_advance.json()["assigned_team_id"] == team_final

    third_advance = client.post(
        f"/api/v1/applications/{app_id}/advance-stage",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert third_advance.status_code == 400, third_advance.text
    assert "final decision" in third_advance.json()["detail"].lower()


def test_final_stage_cannot_advance_further():
    token, _ = _register_tenant("TenantFinal")
    team_ops = _create_team(token, f"Ops Final Team {uuid.uuid4().hex[:6]}")
    team_final = _create_team(token, f"Decision Final Team {uuid.uuid4().hex[:6]}")

    workflow_response = client.put(
        "/api/v1/admin/workflow",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Final Stage Workflow",
            "status": "active",
            "stages": [
                {"stage_type": "OPERATIONS_REVIEW", "team_id": team_ops, "status": "active", "stage_order": 1},
                {"stage_type": "FINAL_DECISION", "team_id": team_final, "status": "active", "stage_order": 2},
            ],
        },
    )
    assert workflow_response.status_code == 200, workflow_response.text

    app_response = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "reference_code": "APP-3003",
            "applicant_name": "Maya Example",
            "applicant_email": "maya@example.com",
        },
    )
    app_id = app_response.json()["id"]

    final_advance = client.post(
        f"/api/v1/applications/{app_id}/advance-stage",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert final_advance.status_code == 200, final_advance.text

    blocked = client.post(
        f"/api/v1/applications/{app_id}/advance-stage",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert blocked.status_code == 400, blocked.text
    assert "final decision" in blocked.json()["detail"].lower()


def test_cross_tenant_application_advance_is_blocked():
    token_a, _ = _register_tenant("TenantATarget")
    token_b, _ = _register_tenant("TenantBTarget")
    team_a = _create_team(token_a, f"Tenant A Op Team {uuid.uuid4().hex[:6]}")
    team_b = _create_team(token_b, f"Tenant B Op Team {uuid.uuid4().hex[:6]}")
    team_b_final = _create_team(token_b, f"Tenant B Final Team {uuid.uuid4().hex[:6]}")

    workflow_b = client.put(
        "/api/v1/admin/workflow",
        headers={"Authorization": f"Bearer {token_b}"},
        json={
            "name": "Tenant B Workflow",
            "status": "active",
            "stages": [
                {"stage_type": "OPERATIONS_REVIEW", "team_id": team_b, "status": "active", "stage_order": 1},
                {"stage_type": "FINAL_DECISION", "team_id": team_b_final, "status": "active", "stage_order": 2},
            ],
        },
    )
    assert workflow_b.status_code == 200, workflow_b.text

    app_b = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token_b}"},
        json={
            "reference_code": "APP-3004",
            "applicant_name": "Nora Example",
            "applicant_email": "nora@example.com",
        },
    )
    app_id = app_b.json()["id"]

    blocked = client.post(
        f"/api/v1/applications/{app_id}/advance-stage",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert blocked.status_code == 404, blocked.text


def _login_as_user(email: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return response.json()["token"]


def test_authorized_reviewer_can_list_assigned_applications():
    token, _ = _register_tenant("TenantReviewerList")
    team_ops = _create_team(token, f"Ops Review Team {uuid.uuid4().hex[:6]}")
    workflow_response = client.put(
        "/api/v1/admin/workflow",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Reviewer List Workflow",
            "status": "active",
            "stages": [
                {"stage_type": "OPERATIONS_REVIEW", "team_id": team_ops, "status": "active", "stage_order": 1},
                {"stage_type": "FINAL_DECISION", "team_id": team_ops, "status": "active", "stage_order": 2},
            ],
        },
    )
    assert workflow_response.status_code == 200, workflow_response.text

    app_response = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "reference_code": "APP-5001",
            "applicant_name": "Olivia Example",
            "applicant_email": "olivia@example.com",
        },
    )
    app_id = app_response.json()["id"]

    reviewer_email = f"reviewer_{uuid.uuid4().hex[:8]}@example.com"
    reviewer_response = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Reviewer User",
            "email": reviewer_email,
            "password": "SecurePass123",
            "status": "active",
            "responsibilities": ["OPERATIONS_REVIEWER"],
            "team_ids": [team_ops],
        },
    )
    assert reviewer_response.status_code == 200, reviewer_response.text
    reviewer_token = _login_as_user(reviewer_email, "SecurePass123")

    response = client.get(
        "/api/v1/reviewer/applications",
        headers={"Authorization": f"Bearer {reviewer_token}"},
    )
    assert response.status_code == 200, response.text
    assert any(item["id"] == app_id for item in response.json())


def test_authorized_reviewer_can_view_assigned_application():
    token, _ = _register_tenant("TenantReviewerView")
    team_ops = _create_team(token, f"Ops View Team {uuid.uuid4().hex[:6]}")
    workflow_response = client.put(
        "/api/v1/admin/workflow",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Reviewer View Workflow",
            "status": "active",
            "stages": [
                {"stage_type": "OPERATIONS_REVIEW", "team_id": team_ops, "status": "active", "stage_order": 1},
                {"stage_type": "FINAL_DECISION", "team_id": team_ops, "status": "active", "stage_order": 2},
            ],
        },
    )
    assert workflow_response.status_code == 200, workflow_response.text

    app_response = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "reference_code": "APP-5002",
            "applicant_name": "Parker Example",
            "applicant_email": "parker@example.com",
        },
    )
    app_id = app_response.json()["id"]

    reviewer_email = f"reviewer_{uuid.uuid4().hex[:8]}@example.com"
    reviewer_response = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Review Viewer",
            "email": reviewer_email,
            "password": "SecurePass123",
            "status": "active",
            "responsibilities": ["OPERATIONS_REVIEWER"],
            "team_ids": [team_ops],
        },
    )
    assert reviewer_response.status_code == 200, reviewer_response.text
    reviewer_token = _login_as_user(reviewer_email, "SecurePass123")

    response = client.get(
        f"/api/v1/reviewer/applications/{app_id}",
        headers={"Authorization": f"Bearer {reviewer_token}"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["id"] == app_id
    assert response.json()["current_workflow_stage"] == "OPERATIONS_REVIEW"


def test_reviewer_can_submit_valid_review_and_advance_stage():
    token, _ = _register_tenant("TenantReviewerSubmit")
    team_ops = _create_team(token, f"Ops Submit Team {uuid.uuid4().hex[:6]}")
    team_final = _create_team(token, f"Final Submit Team {uuid.uuid4().hex[:6]}")
    workflow_response = client.put(
        "/api/v1/admin/workflow",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Reviewer Submit Workflow",
            "status": "active",
            "stages": [
                {"stage_type": "OPERATIONS_REVIEW", "team_id": team_ops, "status": "active", "stage_order": 1},
                {"stage_type": "FINAL_DECISION", "team_id": team_final, "status": "active", "stage_order": 2},
            ],
        },
    )
    assert workflow_response.status_code == 200, workflow_response.text

    app_response = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "reference_code": "APP-5003",
            "applicant_name": "Quinn Example",
            "applicant_email": "quinn@example.com",
        },
    )
    app_id = app_response.json()["id"]

    reviewer_email = f"reviewer_{uuid.uuid4().hex[:8]}@example.com"
    reviewer_response = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Review Submitter",
            "email": reviewer_email,
            "password": "SecurePass123",
            "status": "active",
            "responsibilities": ["OPERATIONS_REVIEWER"],
            "team_ids": [team_ops],
        },
    )
    assert reviewer_response.status_code == 200, reviewer_response.text
    reviewer_token = _login_as_user(reviewer_email, "SecurePass123")

    review_response = client.post(
        f"/api/v1/reviewer/applications/{app_id}/reviews",
        headers={"Authorization": f"Bearer {reviewer_token}"},
        json={
            "status": "approved",
            "comments": "Looks good for next stage.",
        },
    )
    assert review_response.status_code == 200, review_response.text
    payload = review_response.json()
    assert payload["application_id"] == app_id
    assert payload["workflow_stage"] == "OPERATIONS_REVIEW"
    assert payload["status"] == "approved"
    assert payload["next_stage"] == "FINAL_DECISION"
    assert payload["next_team_id"] == team_final

    refreshed = client.get(
        f"/api/v1/applications/{app_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert refreshed.status_code == 200, refreshed.text
    assert refreshed.json()["current_workflow_stage"] == "FINAL_DECISION"
    assert refreshed.json()["assigned_team_id"] == team_final


def test_unauthorized_team_member_is_blocked():
    token, _ = _register_tenant("TenantReviewerBlocked")
    team_ops = _create_team(token, f"Ops Block Team {uuid.uuid4().hex[:6]}")
    team_risk = _create_team(token, f"Risk Block Team {uuid.uuid4().hex[:6]}")
    workflow_response = client.put(
        "/api/v1/admin/workflow",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Blocked Reviewer Workflow",
            "status": "active",
            "stages": [
                {"stage_type": "OPERATIONS_REVIEW", "team_id": team_ops, "status": "active", "stage_order": 1},
                {"stage_type": "FINAL_DECISION", "team_id": team_risk, "status": "active", "stage_order": 2},
            ],
        },
    )
    assert workflow_response.status_code == 200, workflow_response.text

    app_response = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "reference_code": "APP-5004",
            "applicant_name": "Riley Example",
            "applicant_email": "riley@example.com",
        },
    )
    app_id = app_response.json()["id"]

    reviewer_email = f"reviewer_{uuid.uuid4().hex[:8]}@example.com"
    reviewer_response = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Wrong Team Reviewer",
            "email": reviewer_email,
            "password": "SecurePass123",
            "status": "active",
            "responsibilities": ["RISK_REVIEWER"],
            "team_ids": [team_risk],
        },
    )
    assert reviewer_response.status_code == 200, reviewer_response.text
    reviewer_token = _login_as_user(reviewer_email, "SecurePass123")

    response = client.get(
        f"/api/v1/reviewer/applications/{app_id}",
        headers={"Authorization": f"Bearer {reviewer_token}"},
    )
    assert response.status_code == 403, response.text


def test_cross_tenant_reviewer_access_is_blocked():
    token_a, _ = _register_tenant("TenantReviewerA")
    token_b, _ = _register_tenant("TenantReviewerB")
    team_b = _create_team(token_b, f"Tenant B Review Team {uuid.uuid4().hex[:6]}")
    workflow_response = client.put(
        "/api/v1/admin/workflow",
        headers={"Authorization": f"Bearer {token_b}"},
        json={
            "name": "Cross Tenant Reviewer Workflow",
            "status": "active",
            "stages": [
                {"stage_type": "OPERATIONS_REVIEW", "team_id": team_b, "status": "active", "stage_order": 1},
                {"stage_type": "FINAL_DECISION", "team_id": team_b, "status": "active", "stage_order": 2},
            ],
        },
    )
    assert workflow_response.status_code == 200, workflow_response.text

    app_response = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token_b}"},
        json={
            "reference_code": "APP-5005",
            "applicant_name": "Sam Example",
            "applicant_email": "sam@example.com",
        },
    )
    app_id = app_response.json()["id"]

    reviewer_email = f"reviewer_{uuid.uuid4().hex[:8]}@example.com"
    reviewer_response = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token_b}"},
        json={
            "name": "Cross Tenant Reviewer",
            "email": reviewer_email,
            "password": "SecurePass123",
            "status": "active",
            "responsibilities": ["OPERATIONS_REVIEWER"],
            "team_ids": [team_b],
        },
    )
    assert reviewer_response.status_code == 200, reviewer_response.text
    reviewer_token = _login_as_user(reviewer_email, "SecurePass123")

    response = client.get(
        f"/api/v1/reviewer/applications/{app_id}",
        headers={"Authorization": f"Bearer {reviewer_token}"},
    )
    assert response.status_code == 200, response.text

    blocked = client.get(
        f"/api/v1/reviewer/applications/{app_id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert blocked.status_code in {403, 404}, blocked.text


def test_review_of_already_progressed_application_is_blocked():
    token, _ = _register_tenant("TenantReviewerProgressed")
    team_ops = _create_team(token, f"Ops Progress Team {uuid.uuid4().hex[:6]}")
    team_final = _create_team(token, f"Final Progress Team {uuid.uuid4().hex[:6]}")
    workflow_response = client.put(
        "/api/v1/admin/workflow",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Progressed Review Workflow",
            "status": "active",
            "stages": [
                {"stage_type": "OPERATIONS_REVIEW", "team_id": team_ops, "status": "active", "stage_order": 1},
                {"stage_type": "FINAL_DECISION", "team_id": team_final, "status": "active", "stage_order": 2},
            ],
        },
    )
    assert workflow_response.status_code == 200, workflow_response.text
    app_response = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "reference_code": "APP-5006",
            "applicant_name": "Taylor Example",
            "applicant_email": "taylor@example.com",
        },
    )
    app_id = app_response.json()["id"]

    reviewer_email = f"reviewer_{uuid.uuid4().hex[:8]}@example.com"
    reviewer_response = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Progressed Reviewer",
            "email": reviewer_email,
            "password": "SecurePass123",
            "status": "active",
            "responsibilities": ["OPERATIONS_REVIEWER"],
            "team_ids": [team_ops],
        },
    )
    assert reviewer_response.status_code == 200, reviewer_response.text
    reviewer_token = _login_as_user(reviewer_email, "SecurePass123")

    first_review = client.post(
        f"/api/v1/reviewer/applications/{app_id}/reviews",
        headers={"Authorization": f"Bearer {reviewer_token}"},
        json={"status": "approved", "comments": "Approve."},
    )
    assert first_review.status_code == 200, first_review.text

    second_review = client.post(
        f"/api/v1/reviewer/applications/{app_id}/reviews",
        headers={"Authorization": f"Bearer {reviewer_token}"},
        json={"status": "approved", "comments": "Duplicate."},
    )
    assert second_review.status_code in {400, 403}, second_review.text


def test_authorized_final_decision_maker_can_submit_final_decision():
    token, tenant_id = _register_tenant("TenantFinalDecision")
    team_ops = _create_team(token, f"Ops Final Team {uuid.uuid4().hex[:6]}")
    team_final = _create_team(token, f"Final Decision Team {uuid.uuid4().hex[:6]}")
    workflow_response = client.put(
        "/api/v1/admin/workflow",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Final Decision Workflow",
            "status": "active",
            "stages": [
                {"stage_type": "OPERATIONS_REVIEW", "team_id": team_ops, "status": "active", "stage_order": 1},
                {"stage_type": "FINAL_DECISION", "team_id": team_final, "status": "active", "stage_order": 2},
            ],
        },
    )
    assert workflow_response.status_code == 200, workflow_response.text

    app_response = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "reference_code": "APP-6001",
            "applicant_name": "Final Example",
            "applicant_email": "final@example.com",
        },
    )
    assert app_response.status_code == 200, app_response.text
    app_id = app_response.json()["id"]

    reviewer_email = f"reviewer_{uuid.uuid4().hex[:8]}@example.com"
    reviewer_response = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Ops Reviewer",
            "email": reviewer_email,
            "password": "SecurePass123",
            "status": "active",
            "responsibilities": ["OPERATIONS_REVIEWER"],
            "team_ids": [team_ops],
        },
    )
    assert reviewer_response.status_code == 200, reviewer_response.text
    reviewer_token = _login_as_user(reviewer_email, "SecurePass123")

    advance = client.post(
        f"/api/v1/reviewer/applications/{app_id}/reviews",
        headers={"Authorization": f"Bearer {reviewer_token}"},
        json={"status": "approved", "comments": "Ready for final decision."},
    )
    assert advance.status_code == 200, advance.text

    final_reviewer_email = f"final_{uuid.uuid4().hex[:8]}@example.com"
    final_reviewer_response = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Final Decision Maker",
            "email": final_reviewer_email,
            "password": "SecurePass123",
            "status": "active",
            "responsibilities": ["FINAL_DECISION_MAKER"],
            "team_ids": [team_final],
        },
    )
    assert final_reviewer_response.status_code == 200, final_reviewer_response.text
    final_token = _login_as_user(final_reviewer_email, "SecurePass123")

    final_response = client.post(
        f"/api/v1/reviewer/applications/{app_id}/final-decision",
        headers={"Authorization": f"Bearer {final_token}"},
        json={"decision": "approved", "comments": "Approved after review."},
    )
    assert final_response.status_code == 200, final_response.text
    payload = final_response.json()
    assert payload["decision"] == "approved"
    assert payload["application_id"] == app_id
    assert payload["workflow_stage"] == "FINAL_DECISION"

    refreshed = client.get(
        f"/api/v1/applications/{app_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert refreshed.status_code == 200, refreshed.text
    assert refreshed.json()["status"] == "completed"
    assert refreshed.json()["current_workflow_stage"] == "FINAL_DECISION"


def test_final_decision_completes_application_and_persists_record():
    token, tenant_id = _register_tenant("TenantFinalPersist")
    team_ops = _create_team(token, f"Ops Persist Team {uuid.uuid4().hex[:6]}")
    team_final = _create_team(token, f"Final Persist Team {uuid.uuid4().hex[:6]}")
    workflow_response = client.put(
        "/api/v1/admin/workflow",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Persist Final Decision Workflow",
            "status": "active",
            "stages": [
                {"stage_type": "OPERATIONS_REVIEW", "team_id": team_ops, "status": "active", "stage_order": 1},
                {"stage_type": "FINAL_DECISION", "team_id": team_final, "status": "active", "stage_order": 2},
            ],
        },
    )
    assert workflow_response.status_code == 200, workflow_response.text

    app_response = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "reference_code": "APP-6002",
            "applicant_name": "Persist Final",
            "applicant_email": "persistfinal@example.com",
        },
    )
    app_id = app_response.json()["id"]

    ops_email = f"ops_{uuid.uuid4().hex[:8]}@example.com"
    ops_response = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Ops Decision Reviewer",
            "email": ops_email,
            "password": "SecurePass123",
            "status": "active",
            "responsibilities": ["OPERATIONS_REVIEWER"],
            "team_ids": [team_ops],
        },
    )
    assert ops_response.status_code == 200, ops_response.text
    ops_token = _login_as_user(ops_email, "SecurePass123")
    stage_advance = client.post(
        f"/api/v1/reviewer/applications/{app_id}/reviews",
        headers={"Authorization": f"Bearer {ops_token}"},
        json={"status": "approved", "comments": "Proceeding to final decision."},
    )
    assert stage_advance.status_code == 200, stage_advance.text

    final_email = f"final_{uuid.uuid4().hex[:8]}@example.com"
    final_response = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Final Reviewer",
            "email": final_email,
            "password": "SecurePass123",
            "status": "active",
            "responsibilities": ["FINAL_DECISION_MAKER"],
            "team_ids": [team_final],
        },
    )
    assert final_response.status_code == 200, final_response.text
    final_token = _login_as_user(final_email, "SecurePass123")

    decision_response = client.post(
        f"/api/v1/reviewer/applications/{app_id}/final-decision",
        headers={"Authorization": f"Bearer {final_token}"},
        json={"decision": "rejected", "comments": "Not eligible."},
    )
    assert decision_response.status_code == 200, decision_response.text
    assert decision_response.json()["decision"] == "rejected"

    with SessionLocal() as session:
        logs = session.query(AuditLog).filter(AuditLog.tenant_id == tenant_id).all()
        assert any(log.action == "final_decision_submitted" for log in logs)
        assert any(log.resource_id == app_id for log in logs)


def test_completed_application_cannot_receive_another_final_decision():
    token, _ = _register_tenant("TenantCompletedFinal")
    team_ops = _create_team(token, f"Ops Completed Team {uuid.uuid4().hex[:6]}")
    team_final = _create_team(token, f"Final Completed Team {uuid.uuid4().hex[:6]}")
    workflow_response = client.put(
        "/api/v1/admin/workflow",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Completed Final Workflow",
            "status": "active",
            "stages": [
                {"stage_type": "OPERATIONS_REVIEW", "team_id": team_ops, "status": "active", "stage_order": 1},
                {"stage_type": "FINAL_DECISION", "team_id": team_final, "status": "active", "stage_order": 2},
            ],
        },
    )
    assert workflow_response.status_code == 200, workflow_response.text

    app_response = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "reference_code": "APP-6003",
            "applicant_name": "Done Example",
            "applicant_email": "done@example.com",
        },
    )
    app_id = app_response.json()["id"]

    ops_email = f"ops_{uuid.uuid4().hex[:8]}@example.com"
    ops_response = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Ops Decision Reviewer",
            "email": ops_email,
            "password": "SecurePass123",
            "status": "active",
            "responsibilities": ["OPERATIONS_REVIEWER"],
            "team_ids": [team_ops],
        },
    )
    assert ops_response.status_code == 200, ops_response.text
    ops_token = _login_as_user(ops_email, "SecurePass123")
    stage_advance = client.post(
        f"/api/v1/reviewer/applications/{app_id}/reviews",
        headers={"Authorization": f"Bearer {ops_token}"},
        json={"status": "approved", "comments": "Proceed."},
    )
    assert stage_advance.status_code == 200, stage_advance.text

    final_email = f"final_{uuid.uuid4().hex[:8]}@example.com"
    final_response = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Final Reviewer",
            "email": final_email,
            "password": "SecurePass123",
            "status": "active",
            "responsibilities": ["FINAL_DECISION_MAKER"],
            "team_ids": [team_final],
        },
    )
    assert final_response.status_code == 200, final_response.text
    final_token = _login_as_user(final_email, "SecurePass123")

    first = client.post(
        f"/api/v1/reviewer/applications/{app_id}/final-decision",
        headers={"Authorization": f"Bearer {final_token}"},
        json={"decision": "approved", "comments": "Approved."},
    )
    assert first.status_code == 200, first.text

    second = client.post(
        f"/api/v1/reviewer/applications/{app_id}/final-decision",
        headers={"Authorization": f"Bearer {final_token}"},
        json={"decision": "rejected", "comments": "Again."},
    )
    assert second.status_code == 400, second.text
    assert "already been submitted" in second.json()["detail"].lower()


def test_unauthorized_user_cannot_submit_final_decision():
    token, _ = _register_tenant("TenantFinalUnauthorized")
    team_ops = _create_team(token, f"Ops Unauthorized Team {uuid.uuid4().hex[:6]}")
    team_final = _create_team(token, f"Final Unauthorized Team {uuid.uuid4().hex[:6]}")
    workflow_response = client.put(
        "/api/v1/admin/workflow",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Unauthorized Final Workflow",
            "status": "active",
            "stages": [
                {"stage_type": "OPERATIONS_REVIEW", "team_id": team_ops, "status": "active", "stage_order": 1},
                {"stage_type": "FINAL_DECISION", "team_id": team_final, "status": "active", "stage_order": 2},
            ],
        },
    )
    assert workflow_response.status_code == 200, workflow_response.text

    app_response = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "reference_code": "APP-6004",
            "applicant_name": "Unauthorized Example",
            "applicant_email": "unauthorized@example.com",
        },
    )
    app_id = app_response.json()["id"]

    ops_email = f"ops_{uuid.uuid4().hex[:8]}@example.com"
    ops_response = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Ops Reviewer",
            "email": ops_email,
            "password": "SecurePass123",
            "status": "active",
            "responsibilities": ["OPERATIONS_REVIEWER"],
            "team_ids": [team_ops],
        },
    )
    assert ops_response.status_code == 200, ops_response.text
    ops_token = _login_as_user(ops_email, "SecurePass123")
    advance = client.post(
        f"/api/v1/reviewer/applications/{app_id}/reviews",
        headers={"Authorization": f"Bearer {ops_token}"},
        json={"status": "approved", "comments": "Proceeding."},
    )
    assert advance.status_code == 200, advance.text

    wrong_email = f"wrong_{uuid.uuid4().hex[:8]}@example.com"
    wrong_response = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Wrong Role User",
            "email": wrong_email,
            "password": "SecurePass123",
            "status": "active",
            "responsibilities": ["OPERATIONS_REVIEWER"],
            "team_ids": [team_final],
        },
    )
    assert wrong_response.status_code == 200, wrong_response.text
    wrong_token = _login_as_user(wrong_email, "SecurePass123")

    blocked = client.post(
        f"/api/v1/reviewer/applications/{app_id}/final-decision",
        headers={"Authorization": f"Bearer {wrong_token}"},
        json={"decision": "approved", "comments": "Should fail."},
    )
    assert blocked.status_code == 403, blocked.text


def test_cross_tenant_final_decision_is_blocked():
    token_a, _ = _register_tenant("TenantFinalA")
    token_b, tenant_b_id = _register_tenant("TenantFinalB")
    team_ops_b = _create_team(token_b, f"Ops Cross Team {uuid.uuid4().hex[:6]}")
    team_final_b = _create_team(token_b, f"Final Cross Team {uuid.uuid4().hex[:6]}")
    workflow_response = client.put(
        "/api/v1/admin/workflow",
        headers={"Authorization": f"Bearer {token_b}"},
        json={
            "name": "Cross Tenant Final Workflow",
            "status": "active",
            "stages": [
                {"stage_type": "OPERATIONS_REVIEW", "team_id": team_ops_b, "status": "active", "stage_order": 1},
                {"stage_type": "FINAL_DECISION", "team_id": team_final_b, "status": "active", "stage_order": 2},
            ],
        },
    )
    assert workflow_response.status_code == 200, workflow_response.text

    app_response = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token_b}"},
        json={
            "reference_code": "APP-6005",
            "applicant_name": "Cross Tenant Final",
            "applicant_email": "crossfinal@example.com",
        },
    )
    app_id = app_response.json()["id"]

    ops_email = f"ops_{uuid.uuid4().hex[:8]}@example.com"
    ops_response = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token_b}"},
        json={
            "name": "Ops Cross Reviewer",
            "email": ops_email,
            "password": "SecurePass123",
            "status": "active",
            "responsibilities": ["OPERATIONS_REVIEWER"],
            "team_ids": [team_ops_b],
        },
    )
    assert ops_response.status_code == 200, ops_response.text
    ops_token = _login_as_user(ops_email, "SecurePass123")
    advance = client.post(
        f"/api/v1/reviewer/applications/{app_id}/reviews",
        headers={"Authorization": f"Bearer {ops_token}"},
        json={"status": "approved", "comments": "Advance."},
    )
    assert advance.status_code == 200, advance.text

    final_email = f"final_{uuid.uuid4().hex[:8]}@example.com"
    final_response = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token_b}"},
        json={
            "name": "Final Cross User",
            "email": final_email,
            "password": "SecurePass123",
            "status": "active",
            "responsibilities": ["FINAL_DECISION_MAKER"],
            "team_ids": [team_final_b],
        },
    )
    assert final_response.status_code == 200, final_response.text
    final_token = _login_as_user(final_email, "SecurePass123")

    blocked = client.post(
        f"/api/v1/reviewer/applications/{app_id}/final-decision",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"decision": "approved", "comments": "Not allowed."},
    )
    assert blocked.status_code in {403, 404}, blocked.text


def test_final_decision_audit_records_are_tenant_isolated():
    token_a, tenant_a_id = _register_tenant("TenantAuditA")
    token_b, tenant_b_id = _register_tenant("TenantAuditB")
    team_ops_a = _create_team(token_a, f"Ops Audit A {uuid.uuid4().hex[:6]}")
    team_final_a = _create_team(token_a, f"Final Audit A {uuid.uuid4().hex[:6]}")
    team_ops_b = _create_team(token_b, f"Ops Audit B {uuid.uuid4().hex[:6]}")
    team_final_b = _create_team(token_b, f"Final Audit B {uuid.uuid4().hex[:6]}")

    workflow_a = client.put(
        "/api/v1/admin/workflow",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "name": "Audit Workflow A",
            "status": "active",
            "stages": [
                {"stage_type": "OPERATIONS_REVIEW", "team_id": team_ops_a, "status": "active", "stage_order": 1},
                {"stage_type": "FINAL_DECISION", "team_id": team_final_a, "status": "active", "stage_order": 2},
            ],
        },
    )
    assert workflow_a.status_code == 200, workflow_a.text
    workflow_b = client.put(
        "/api/v1/admin/workflow",
        headers={"Authorization": f"Bearer {token_b}"},
        json={
            "name": "Audit Workflow B",
            "status": "active",
            "stages": [
                {"stage_type": "OPERATIONS_REVIEW", "team_id": team_ops_b, "status": "active", "stage_order": 1},
                {"stage_type": "FINAL_DECISION", "team_id": team_final_b, "status": "active", "stage_order": 2},
            ],
        },
    )
    assert workflow_b.status_code == 200, workflow_b.text

    app_a = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"reference_code": "APP-6006", "applicant_name": "Audit A", "applicant_email": "audit-a@example.com"},
    )
    app_b = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token_b}"},
        json={"reference_code": "APP-6007", "applicant_name": "Audit B", "applicant_email": "audit-b@example.com"},
    )
    app_a_id = app_a.json()["id"]
    app_b_id = app_b.json()["id"]

    ops_email_a = f"ops_a_{uuid.uuid4().hex[:8]}@example.com"
    ops_response_a = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"name": "Ops A", "email": ops_email_a, "password": "SecurePass123", "status": "active", "responsibilities": ["OPERATIONS_REVIEWER"], "team_ids": [team_ops_a]},
    )
    assert ops_response_a.status_code == 200, ops_response_a.text
    ops_a_t = _login_as_user(ops_email_a, "SecurePass123")
    client.post(
        f"/api/v1/reviewer/applications/{app_a_id}/reviews",
        headers={"Authorization": f"Bearer {ops_a_t}"},
        json={"status": "approved", "comments": "advance A"},
    )

    final_email_a = f"final_a_{uuid.uuid4().hex[:8]}@example.com"
    final_response_a = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"name": "Final A", "email": final_email_a, "password": "SecurePass123", "status": "active", "responsibilities": ["FINAL_DECISION_MAKER"], "team_ids": [team_final_a]},
    )
    assert final_response_a.status_code == 200, final_response_a.text
    final_a_t = _login_as_user(final_email_a, "SecurePass123")
    client.post(
        f"/api/v1/reviewer/applications/{app_a_id}/final-decision",
        headers={"Authorization": f"Bearer {final_a_t}"},
        json={"decision": "approved", "comments": "approved A"},
    )

    ops_email_b = f"ops_b_{uuid.uuid4().hex[:8]}@example.com"
    ops_response_b = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token_b}"},
        json={"name": "Ops B", "email": ops_email_b, "password": "SecurePass123", "status": "active", "responsibilities": ["OPERATIONS_REVIEWER"], "team_ids": [team_ops_b]},
    )
    assert ops_response_b.status_code == 200, ops_response_b.text
    ops_b_t = _login_as_user(ops_email_b, "SecurePass123")
    client.post(
        f"/api/v1/reviewer/applications/{app_b_id}/reviews",
        headers={"Authorization": f"Bearer {ops_b_t}"},
        json={"status": "approved", "comments": "advance B"},
    )

    final_email_b = f"final_b_{uuid.uuid4().hex[:8]}@example.com"
    final_response_b = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token_b}"},
        json={"name": "Final B", "email": final_email_b, "password": "SecurePass123", "status": "active", "responsibilities": ["FINAL_DECISION_MAKER"], "team_ids": [team_final_b]},
    )
    assert final_response_b.status_code == 200, final_response_b.text
    final_b_t = _login_as_user(final_email_b, "SecurePass123")
    client.post(
        f"/api/v1/reviewer/applications/{app_b_id}/final-decision",
        headers={"Authorization": f"Bearer {final_b_t}"},
        json={"decision": "rejected", "comments": "rejected B"},
    )

    with SessionLocal() as session:
        tenant_a_logs = session.query(AuditLog).filter(AuditLog.tenant_id == tenant_a_id).all()
        tenant_b_logs = session.query(AuditLog).filter(AuditLog.tenant_id == tenant_b_id).all()
        assert any(log.action == "final_decision_submitted" and log.resource_id == app_a_id for log in tenant_a_logs)
        assert any(log.action == "final_decision_submitted" and log.resource_id == app_b_id for log in tenant_b_logs)
        assert all(log.resource_id != app_b_id for log in tenant_a_logs)
        assert all(log.resource_id != app_a_id for log in tenant_b_logs)


def test_unauthenticated_access_is_rejected():
    response = client.get("/api/v1/applications")
    assert response.status_code == 401, response.text


def test_reviewer_with_multiple_team_roles_can_access_matching_workflow_stage():
    token, _ = _register_tenant("TenantMultiMembership")
    team_ops = _create_team(token, f"Ops Multi {uuid.uuid4().hex[:6]}")
    team_credit = _create_team(token, f"Credit Multi {uuid.uuid4().hex[:6]}")
    team_final = _create_team(token, f"Final Multi {uuid.uuid4().hex[:6]}")

    workflow = client.put(
        "/api/v1/admin/workflow",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Multi Membership Workflow",
            "status": "active",
            "stages": [
                {"stage_type": "OPERATIONS_REVIEW", "team_id": team_ops, "status": "active"},
                {"stage_type": "CREDIT_COMMITTEE_REVIEW", "team_id": team_credit, "status": "active"},
                {"stage_type": "FINAL_DECISION", "team_id": team_final, "status": "active"},
            ],
        },
    )
    assert workflow.status_code == 200, workflow.text

    application = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {token}"},
        json={"reference_code": "APP-MULTI-ROLE", "applicant_name": "Multi Role Applicant"},
    )
    assert application.status_code == 200, application.text
    application_id = application.json()["id"]

    reviewer_email = f"multi_reviewer_{uuid.uuid4().hex[:8]}@example.com"
    reviewer = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Multi Stage Reviewer",
            "email": reviewer_email,
            "password": "SecurePass123",
            "responsibilities": ["OPERATIONS_REVIEWER"],
            "team_ids": [team_ops],
        },
    )
    assert reviewer.status_code == 200, reviewer.text
    reviewer_id = reviewer.json()["id"]

    for team_id, role in ((team_credit, "CREDIT_COMMITTEE_REVIEWER"), (team_final, "FINAL_DECISION_MAKER")):
        assigned = client.post(
            f"/api/v1/admin/users/{reviewer_id}/teams",
            headers={"Authorization": f"Bearer {token}"},
            json={"team_id": team_id, "role": role},
        )
        assert assigned.status_code == 200, assigned.text

    reviewer_token = _login_as_user(reviewer_email, "SecurePass123")
    auth_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {reviewer_token}"})
    assert auth_me.status_code == 200, auth_me.text
    assert {team["role"] for team in auth_me.json()["teams"]} >= {
        "Credit Committee Reviewer",
        "Final Decision Maker",
    }

    first_advance = client.post(
        f"/api/v1/applications/{application_id}/advance-stage",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert first_advance.status_code == 200, first_advance.text

    queue = client.get("/api/v1/reviewer/applications", headers={"Authorization": f"Bearer {reviewer_token}"})
    assert queue.status_code == 200, queue.text
    assert any(item["id"] == application_id for item in queue.json())
