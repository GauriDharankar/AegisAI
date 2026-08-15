from fastapi import APIRouter

from app.schemas.governance import GovernanceRequest
from app.services.governance_service import governance_service


router = APIRouter(
    prefix="/api/v1/governance",
    tags=["Governance"]
)


@router.post("/evaluate")
def evaluate_governance(
    request: GovernanceRequest
):

    result = governance_service.evaluate(

        # -------------------------------------------------
        # Tenant
        # -------------------------------------------------

        tenant_id=request.tenant_id,

        # -------------------------------------------------
        # Applicant Features
        # -------------------------------------------------

        features=request.features,

        # -------------------------------------------------
        # ML Prediction
        # -------------------------------------------------

        prediction=request.prediction.model_dump(),

        # -------------------------------------------------
        # Fairness Data
        # -------------------------------------------------

        fairness_data={
            "predictions": request.fairness.predictions,

            "protected_groups":
                request.fairness.protected_groups,

            "threshold":
                request.fairness.threshold
        },

        # -------------------------------------------------
        # Tenant Policies
        # -------------------------------------------------

        policies=request.policies,

        # -------------------------------------------------
        # Tenant Configuration
        # -------------------------------------------------

        configuration={

            "auto_approve_enabled":
                request.auto_approve.enabled,

            "auto_approve_probability":
                request.auto_approve.minimum_probability
        }
    )

    return result