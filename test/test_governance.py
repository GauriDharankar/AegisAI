from app.services.governance_service import GovernanceService


service = GovernanceService()


def base_request():
    return {
        "tenant_id": "tenant_001",

        "features": {
            "income": 75000,
            "credit_score": 760,
            "loan_amount": 300000,
            "debt_to_income": 0.25,
            "employment_years": 6
        },

        "prediction": {
            "label": "approve",
            "probability": 0.91
        },

        "fairness_data": {
            "predictions": [
                1, 1, 1, 0,
                1, 1, 1, 0
            ],
            "protected_groups": [
                "male", "male", "male", "male",
                "female", "female", "female", "female"
            ],
            "threshold": 0.10
        },

        "policies": {
            "minimum_credit_score": 650,
            "minimum_income": 25000,
            "maximum_debt_to_income": 0.45,
            "maximum_loan_amount": 500000
        },

        "configuration": {
            "auto_approve_enabled": True,
            "auto_approve_probability": 0.85
        }
    }


# ============================================================
# TEST 1 — AUTO APPROVE
# ============================================================

def test_auto_approve():

    data = base_request()

    result = service.evaluate(**data)

    assert result["decision"]["final_decision"] == "AUTO_APPROVE"
    assert result["governance_status"] == "approved"
    assert result["risk"]["level"] == "LOW"


# ============================================================
# TEST 2 — AUTO APPROVE DISABLED
# ============================================================

def test_auto_approve_disabled():

    data = base_request()

    data["configuration"]["auto_approve_enabled"] = False

    result = service.evaluate(**data)

    assert result["decision"]["final_decision"] == "HUMAN_REVIEW"
    assert result["governance_status"] == "review_required"


# ============================================================
# TEST 3 — FAIRNESS VIOLATION
# ============================================================

def test_fairness_violation():

    data = base_request()

    data["fairness_data"] = {
        "predictions": [
            1, 1, 1, 0,
            1, 0, 0, 0
        ],

        "protected_groups": [
            "male", "male", "male", "male",
            "female", "female", "female", "female"
        ],

        "threshold": 0.10
    }

    result = service.evaluate(**data)

    assert result["fairness"]["status"] == "violation"
    assert result["decision"]["final_decision"] == "HUMAN_REVIEW"
    assert result["risk"]["level"] == "HIGH"


# ============================================================
# TEST 4 — POLICY VIOLATION
# ============================================================

def test_policy_violation():

    data = base_request()

    data["features"]["credit_score"] = 600

    result = service.evaluate(**data)

    assert result["policy_compliance"]["status"] == "violation"
    assert result["decision"]["final_decision"] == "REJECT"
    assert result["risk"]["level"] == "HIGH"


# ============================================================
# TEST 5 — ML REJECTION
# ============================================================

def test_ml_rejection():

    data = base_request()

    data["prediction"] = {
        "label": "reject",
        "probability": 0.20
    }

    result = service.evaluate(**data)

    assert result["decision"]["final_decision"] == "REJECT"
    assert result["risk"]["level"] == "HIGH"


# ============================================================
# TEST 6 — GOVERNANCE METADATA
# ============================================================

def test_governance_metadata():

    data = base_request()

    result = service.evaluate(**data)

    assert result["tenant_id"] == "tenant_001"
    assert result["governance_id"].startswith("GOV-")
    assert result["timestamp"] is not None