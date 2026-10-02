
import os

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.encoders import jsonable_encoder

from app.schemas.governance import GovernanceRequest
from app.services.governance_service import governance_service


router = APIRouter(
    prefix="/api/v1/governance",
    tags=["Governance"]
)

BLOCKCHAIN_AUDIT_URL = os.getenv(
    "BLOCKCHAIN_AUDIT_URL",
    "http://localhost:3000/api/audit"
)

@router.post("/evaluate")
async def evaluate_governance(request: GovernanceRequest):

    # 1. Evaluate governance using the existing engine
    result = governance_service.evaluate(
        tenant_id=request.tenant_id,
        features=request.features,
        prediction=request.prediction.model_dump(),

        fairness_data={
            "predictions": request.fairness.predictions,
            "protected_groups": request.fairness.protected_groups,
            "config": request.fairness.config.model_dump()
        },

        policies=[
            policy.model_dump()
            for policy in request.policies
        ],

        configuration={
            "fairness": request.configuration.fairness.model_dump(),
            "risk": request.configuration.risk.model_dump(),
            "auto_approve": (
                request.configuration.auto_approve.model_dump()
            )
        }
    )

    result_data = jsonable_encoder(result)

    # 2. Extract final decision
    final_decision = "UNMAPPED"

    if isinstance(result_data, dict):

        decision_obj = result_data.get("decision", {})

        final_decision = (
            result_data.get("final_decision")
            or (
                decision_obj.get("final_decision")
                if isinstance(decision_obj, dict)
                else None
            )
            or result_data.get("governance_decision")
            or "UNMAPPED"
        )

    final_decision = str(final_decision).upper()

    # 3. Prepare audit record
    audit_payload = {
        "application_id": request.application_id,
        "tenant_id": request.tenant_id,
        "event_type": "GOVERNANCE_EVALUATION",

        "ai_decision": request.prediction.label.upper(),
        "ai_score": request.prediction.probability,

        "human_review": final_decision in {
            "REVIEW",
            "ESCALATE",
            "MANUAL_REVIEW",
            "HUMAN_REVIEW"
        },

        "final_decision": final_decision,

        "governance_result": result_data
    }

    # 4. Submit audit to blockchain service
    try:

        async with httpx.AsyncClient(timeout=15.0) as client:

            response = await client.post(
                BLOCKCHAIN_AUDIT_URL,
                json=audit_payload
            )

        print("\n========== BLOCKCHAIN RESPONSE ==========")
        print("Status:", response.status_code)
        print("Body:", response.text)
        print("=========================================\n")

        response.raise_for_status()

        blockchain_receipt = response.json()

    except Exception as e:

        print("\n========== BLOCKCHAIN ERROR ==========")
        print("Error type:", type(e).__name__)
        print("Error:", repr(e))
        print("======================================\n")

        raise HTTPException(
            status_code=502,
            detail={
                "message": (
                    "Governance evaluation completed, "
                    "but blockchain audit submission failed"
                ),
                "application_id": request.application_id,
                "audit_status": "FAILED",
                "reason": str(e)
            }
        )

    # 5. Return governance result + blockchain receipt
    if isinstance(result_data, dict):
        response_data = dict(result_data)
    else:
        response_data = {
            "governance_result": result_data
        }

    response_data["blockchain_audit"] = {
        "status": blockchain_receipt.get(
            "status",
            "UNKNOWN"
        ),

        "application_id": request.application_id,

        "audit_hash": blockchain_receipt.get(
            "audit_hash"
        ),

        "transaction_hash": blockchain_receipt.get(
            "transaction_hash"
        ),

        "audit_index": blockchain_receipt.get(
            "audit_index"
        )
    }

    return response_data