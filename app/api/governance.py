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
            "predictions":
                request.fairness.predictions,

            "protected_groups":
                request.fairness.protected_groups,

            "config":
                request.fairness.config.model_dump()
        },

        # -------------------------------------------------
        # Tenant Policies
        # -------------------------------------------------

        policies=[
            policy.model_dump()
            for policy in request.policies
        ],

        # -------------------------------------------------
        # Tenant Configuration
        # -------------------------------------------------

        configuration={
            "fairness":
                request.configuration.fairness.model_dump(),

            "risk":
                request.configuration.risk.model_dump(),

            "auto_approve":
                request.configuration.auto_approve.model_dump()
        }
    )

    return result