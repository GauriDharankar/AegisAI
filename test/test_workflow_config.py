import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _unique_org_name(prefix: str = "Workflow Org") -> str:
    return f"{prefix} {uuid.uuid4().hex[:8]}"


def _register_admin():
    org_name = _unique_org_name("Workflow")
    email = f"workflow_{uuid.uuid4().hex[:8]}@example.com"
    password = "SecurePass123"

    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "organization_name": org_name,
            "name": "Workflow Admin",
            "email": email,
            "password": password,
            "confirm_password": password,
        },
    )
    assert register_response.status_code == 200, register_response.text
    token = register_response.json()["token"]
    return token, org_name


def test_workflow_returns_default_stages_for_new_tenant():
    token, _ = _register_admin()

    response = client.get(
        "/api/v1/admin/workflow",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, response.text

    payload = response.json()
    assert payload["name"] == "Default Governance Workflow"
    assert len(payload["stages"]) >= 1
    assert {stage["stage_type"] for stage in payload["stages"]} >= {"OPERATIONS_REVIEW", "FINAL_DECISION"}


def test_admin_can_replace_workflow_with_tenant_specific_stages():
    token, _ = _register_admin()

    created_team = client.post(
        "/api/v1/admin/teams",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Workflow Standalone Team", "description": "Workflow test team", "status": "active"},
    )
    assert created_team.status_code == 200, created_team.text
    team_id = created_team.json()["id"]

    workflow_response = client.put(
        "/api/v1/admin/workflow",
        headers={"Authorization": "Bearer " + token},
        json={
            "name": "Custom Workflow",
            "status": "active",
            "stages": [
                {"stage_type": "OPERATIONS_REVIEW", "team_id": team_id, "status": "active"},
                {"stage_type": "FINAL_DECISION", "team_id": team_id, "status": "active"},
            ],
        },
    )
    assert workflow_response.status_code == 200, workflow_response.text
    payload = workflow_response.json()
    assert payload["name"] == "Custom Workflow"
    assert len(payload["stages"]) == 2
    assert payload["stages"][0]["stage_type"] == "OPERATIONS_REVIEW"
    assert payload["stages"][1]["stage_type"] == "FINAL_DECISION"


def test_workflow_rejects_missing_review_before_final_decision():
    token, _ = _register_admin()

    response = client.put(
        "/api/v1/admin/workflow",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Invalid Workflow",
            "status": "active",
            "stages": [
                {"stage_type": "FINAL_DECISION", "team_id": None, "status": "active"},
            ],
        },
    )
    assert response.status_code == 400, response.text
    assert "review stage" in response.json()["detail"].lower()


def test_risk_based_workflow_can_omit_final_decision_stage():
    token, _ = _register_admin()

    routing_response = client.put(
        "/api/v1/admin/risk-routing",
        headers={"Authorization": "Bearer " + token},
        json={
            "enabled": True,
            "review_stage": "RISK_REVIEW",
        },
    )
    assert routing_response.status_code == 200, routing_response.text

    workflow_response = client.put(
        "/api/v1/admin/workflow",
        headers={"Authorization": "Bearer " + token},
        json={
            "name": "Risk-Based Single Review Workflow",
            "status": "active",
            "stages": [
                {"stage_type": "RISK_REVIEW", "team_id": None, "status": "active"},
            ],
        },
    )
    assert workflow_response.status_code == 200, workflow_response.text
    assert [stage["stage_type"] for stage in workflow_response.json()["stages"]] == ["RISK_REVIEW"]


def test_risk_based_workflow_can_have_zero_stages():
    token, _ = _register_admin()

    routing_response = client.put(
        "/api/v1/admin/risk-routing",
        headers={"Authorization": "Bearer " + token},
        json={"enabled": True, "review_stage": "RISK_REVIEW"},
    )
    assert routing_response.status_code == 200, routing_response.text

    workflow_response = client.put(
        "/api/v1/admin/workflow",
        headers={"Authorization": "Bearer " + token},
        json={
            "name": "Zero Stage Risk Routing",
            "status": "active",
            "stages": [],
        },
    )
    assert workflow_response.status_code == 200, workflow_response.text
    assert workflow_response.json()["stages"] == []
