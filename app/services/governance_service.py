from datetime import datetime, timezone
import uuid

from app.services.model_service import loan_model
from app.services.shap_service import SHAPService
from app.services.fairness_service import FairnessService
from app.services.policy_service import PolicyService
from app.services.routing_service import RoutingService
from app.services.risk_service import RiskService


class GovernanceService:
    """
    Orchestrates the complete AegisAI governance workflow.

    Workflow:

        ML Prediction
              ↓
        SHAP Explainability
              ↓
        Fairness & Bias Analysis
              ↓
        Policy Compliance
              ↓
        Governance Risk Assessment
              ↓
        Intelligent Decision Routing
              ↓
        Final Governance Decision
    """

    def __init__(self):

        # =====================================================
        # Demo ML Model
        # =====================================================
        #
        # In the final integrated system, the bank's existing
        # ML model provides the prediction to AegisAI.
        #
        # The local model is currently used for development
        # and SHAP demonstration.
        # =====================================================

        self.model = loan_model

        # =====================================================
        # Governance Components
        # =====================================================

        self.shap_service = SHAPService(
            self.model.get_model()
        )

        self.fairness_service = FairnessService()

        self.policy_service = PolicyService()

        self.routing_service = RoutingService()

        self.risk_service = RiskService()

    # =========================================================
    # Main Governance Workflow
    # =========================================================

    def evaluate(
        self,
        tenant_id: str,
        features: dict,
        prediction: dict,
        fairness_data: dict,
        policies: dict,
        configuration: dict
    ):

        # =====================================================
        # 1. Generate Governance ID
        # =====================================================

        governance_id = (
            f"GOV-{uuid.uuid4().hex[:12].upper()}"
        )

        # =====================================================
        # 2. Generate Timestamp
        # =====================================================

        timestamp = datetime.now(
            timezone.utc
        ).isoformat()

        # =====================================================
        # 3. SHAP Explainability
        # =====================================================

        explanation = self.shap_service.explain(
            features
        )

        # =====================================================
        # 4. Fairness & Bias Analysis
        # =====================================================

        fairness_result = (
            self.fairness_service.demographic_parity(
                predictions=fairness_data["predictions"],

                protected_groups=fairness_data[
                    "protected_groups"
                ],

                threshold=fairness_data.get(
                    "threshold",
                    0.10
                )
            )
        )

        # =====================================================
        # 5. Policy Compliance
        # =====================================================

        policy_result = (
            self.policy_service.check_compliance(
                features=features,
                policies=policies
            )
        )

        # =====================================================
        # 6. Governance Risk Assessment
        # =====================================================

        risk_level = (
            self.risk_service.calculate_risk(
                prediction=prediction,
                fairness_result=fairness_result,
                policy_result=policy_result
            )
        )

        # =====================================================
        # 7. Intelligent Decision Routing
        # =====================================================

        routing_result = (
            self.routing_service.route_decision(
                prediction=prediction,
                fairness_result=fairness_result,
                policy_result=policy_result,
                configuration=configuration
            )
        )

        # =====================================================
        # 8. Determine Overall Governance Status
        # =====================================================

        if routing_result["route"] == "AUTO_APPROVE":

            governance_status = "approved"

        elif routing_result["route"] == "HUMAN_REVIEW":

            governance_status = "review_required"

        else:

            governance_status = "rejected"

        # =====================================================
        # 9. Final Governance Response
        # =====================================================

        return {

            # -------------------------------------------------
            # Tenant & Audit Information
            # -------------------------------------------------

            "tenant_id": tenant_id,

            "governance_id": governance_id,

            "timestamp": timestamp,

            # -------------------------------------------------
            # Overall Governance Result
            # -------------------------------------------------

            "governance_status": governance_status,

            # -------------------------------------------------
            # Governance Risk
            # -------------------------------------------------

            "risk": {
                "level": risk_level
            },

            # -------------------------------------------------
            # Decision Information
            # -------------------------------------------------

            "decision": {

                "original_prediction":
                    prediction["label"],

                "model_probability":
                    prediction["probability"],

                "final_decision":
                    routing_result["route"]
            },

            # -------------------------------------------------
            # SHAP Explainability
            # -------------------------------------------------

            "explainability": explanation,

            # -------------------------------------------------
            # Fairness & Bias
            # -------------------------------------------------

            "fairness": fairness_result,

            # -------------------------------------------------
            # Policy Compliance
            # -------------------------------------------------

            "policy_compliance": policy_result,

            # -------------------------------------------------
            # Intelligent Routing
            # -------------------------------------------------

            "routing": routing_result
        }


# =============================================================
# Shared Governance Service Instance
# =============================================================

governance_service = GovernanceService()