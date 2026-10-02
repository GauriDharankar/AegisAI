
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

    # 1. Evaluate governance using your existing engine
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

    # 2. Extract the final decision from the governance result.
    # Confirm the key names against your actual service response.
    final_decision = "UNMAPPED"

    if isinstance(result_data, dict):
        final_decision = (
            result_data.get("final_decision")
            or result_data.get("decision")
            or result_data.get("governance_decision")
            or "UNMAPPED"
        )

    final_decision = str(final_decision).upper()

    # 3. Prepare the audit record.
    # Avoid sending raw applicant features or unnecessary PII.
    audit_payload = {
        "application_id": request.application_id,
        "tenant_id": request.tenant_id,
        "event_type": "GOVERNANCE_EVALUATION",
        "ai_decision": request.prediction.label.upper(),
        "ai_score": request.prediction.probability,
        "human_review": final_decision in {
            "REVIEW",
            "ESCALATE",
            "MANUAL_REVIEW"
        },
        "final_decision": final_decision,
        "governance_result": result_data
    }

    # 4. Submit the audit record to the Node.js service.
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                BLOCKCHAIN_AUDIT_URL,
                json=audit_payload
            )

            response.raise_for_status()
            audit_result = response.json()

            if not audit_result.get("success"):
                raise HTTPException(
                    status_code=502,
                    detail="Blockchain audit service rejected the record"
                )

    except HTTPException:
        raise

    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "message": (
                    "Governance evaluation completed, but blockchain "
                    "audit submission failed"
                ),
                "application_id": request.application_id,
                "audit_status": "FAILED",
                "reason": str(exc)
            }
        ) from exc

    # 5. Return the governance result and audit receipt.
    if isinstance(result_data, dict):
        response_data = dict(result_data)
    else:
        response_data = {"governance_result": result_data}

    response_data["blockchain_audit"] = {
        "status": audit_result.get("status", "UNKNOWN"),
        "application_id": request.application_id,
        "audit_hash": audit_result.get("audit_hash"),
        "transaction_hash": audit_result.get("transaction_hash"),
        "audit_index": audit_result.get("audit_index")
    }

    return response_data