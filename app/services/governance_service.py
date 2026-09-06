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
    Central AegisAI AI Governance Engine.

    Workflow:

        ML Prediction
              ↓
        SHAP Explainability
              ↓
        Fairness Analysis
              ↓
        Policy Compliance
              ↓
        Risk Assessment
              ↓
        Intelligent Routing
              ↓
        Final Governance Decision
    """

    def __init__(self):

        self.model = loan_model

        self.shap_service = SHAPService(
            self.model.get_model()
        )

        self.fairness_service = FairnessService()

        self.policy_service = PolicyService()

        self.routing_service = RoutingService()

        self.risk_service = RiskService()

    # =========================================================
    # MAIN GOVERNANCE WORKFLOW
    # =========================================================

    def evaluate(
        self,
        tenant_id: str,
        features: dict,
        prediction: dict,
        fairness_data: dict,
        policies: list,
        configuration: dict
    ):

        governance_id = (
            f"GOV-{uuid.uuid4().hex[:12].upper()}"
        )

        timestamp = datetime.now(
            timezone.utc
        ).isoformat()

        decision_trace = []

        # =====================================================
        # 1. MODEL
        # =====================================================

        decision_trace.append({
            "stage": "MODEL",
            "status": "completed",
            "result": prediction.get("label"),
            "probability": prediction.get(
                "probability"
            )
        })

        # =====================================================
        # 2. SHAP
        # =====================================================

        explanation = self.shap_service.explain(
            features
        )

        decision_trace.append({
            "stage": "SHAP",
            "status": "completed",
            "result": "explained"
        })

        # =====================================================
        # 3. FAIRNESS
        # =====================================================

        fairness_config = fairness_data.get(
            "config",
            {}
        )

        fairness_enabled = fairness_config.get(
            "enabled",
            True
        )

        if fairness_enabled:

            fairness_result = (
                self.fairness_service.demographic_parity(
                    predictions=fairness_data.get(
                        "predictions",
                        []
                    ),
                    protected_groups=fairness_data.get(
                        "protected_groups",
                        []
                    ),
                    threshold=fairness_config.get(
                        "threshold",
                        0.10
                    ),
                    minimum_group_size=fairness_config.get(
                        "minimum_group_size",
                        1
                    )
                )
            )

        else:

            fairness_result = {
                "status": "disabled",
                "metric": "demographic_parity",
                "passed": True,
                "message": (
                    "Fairness analysis is disabled "
                    "for this tenant."
                )
            }

        decision_trace.append({
            "stage": "FAIRNESS",
            "status": fairness_result.get(
                "status"
            ),
            "result": (
                "pass"
                if fairness_result.get(
                    "passed"
                )
                else fairness_result.get(
                    "status"
                )
            )
        })

        # =====================================================
        # 4. POLICY
        # =====================================================

        policy_result = (
            self.policy_service.check_compliance(
                features=features,
                policies=policies
            )
        )

        decision_trace.append({
            "stage": "POLICY",
            "status": policy_result.get(
                "status"
            ),
            "result": (
                "pass"
                if policy_result.get(
                    "passed"
                )
                else policy_result.get(
                    "status"
                )
            )
        })

        # =====================================================
        # 5. RISK
        # =====================================================

        risk_config = configuration.get(
            "risk",
            {}
        )

        risk_level = (
            self.risk_service.calculate_risk(
                prediction=prediction,
                fairness_result=fairness_result,
                policy_result=policy_result,
                low_probability=risk_config.get(
                    "low_probability",
                    0.85
                ),
                medium_probability=risk_config.get(
                    "medium_probability",
                    0.65
                )
            )
        )

        decision_trace.append({
            "stage": "RISK",
            "status": "completed",
            "result": risk_level
        })

        # =====================================================
        # 6. ROUTING
        # =====================================================

        routing_result = (
            self.routing_service.route_decision(
                prediction=prediction,
                fairness_result=fairness_result,
                policy_result=policy_result,
                risk_level=risk_level,
                configuration=configuration
            )
        )

        decision_trace.append({
            "stage": "ROUTING",
            "status": "completed",
            "result": routing_result[
                "route"
            ],
            "reason_code": routing_result.get(
                "reason_code"
            )
        })

        # =====================================================
        # 7. FINAL STATUS
        # =====================================================

        route = routing_result[
            "route"
        ]

        if route == "AUTO_APPROVE":

            governance_status = "approved"

        elif route == "HUMAN_REVIEW":

            governance_status = "review_required"

        else:

            governance_status = "rejected"

        decision_trace.append({
            "stage": "FINAL",
            "status": governance_status,
            "result": route
        })

        # =====================================================
        # 8. FINAL RESPONSE
        # =====================================================

        return {

            "tenant_id": tenant_id,

            "governance_id": governance_id,

            "timestamp": timestamp,

            "governance_status":
                governance_status,

            "risk": {
                "level": risk_level
            },

            "decision": {

                "original_prediction":
                    prediction["label"],

                "model_probability":
                    prediction["probability"],

                "final_decision":
                    route,

                "reason_code":
                    routing_result.get(
                        "reason_code"
                    ),

                "reason":
                    routing_result.get(
                        "reason"
                    )
            },

            "explainability":
                explanation,

            "fairness":
                fairness_result,

            "policy_compliance":
                policy_result,

            "routing":
                routing_result,

            "decision_trace":
                decision_trace
        }


governance_service = GovernanceService()