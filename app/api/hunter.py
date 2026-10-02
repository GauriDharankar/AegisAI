from fastapi import APIRouter

from app.schemas.hunter import HunterApplicationRequest
from app.services.hunter_service import hunter_service


router = APIRouter(
    prefix="/api/v1/hunter",
    tags=["Hunter"]
)


@router.post("/check")
def check_application(
    request: HunterApplicationRequest
):
    return hunter_service.check_application(
        tenant_id=request.tenant_id,
        applicant_id=request.applicant_id,
        loan_type=request.loan_type,
        loan_amount=request.loan_amount,
        application_id=request.application_id,
    )


@router.get("/alerts/{tenant_id}")
def get_bank_alerts(
    tenant_id: str
):
    return {
        "tenant_id": tenant_id,
        "alerts": hunter_service.get_bank_alerts(
            tenant_id
        )
    }


@router.get("/applications/{tenant_id}")
def get_bank_applications(
    tenant_id: str
):
    return {
        "tenant_id": tenant_id,
        "applications": hunter_service.get_applications(
            tenant_id
        )
    }


@router.get("/audit/{tenant_id}")
def get_hunter_audit_events(
    tenant_id: str
):
    return {
        "tenant_id": tenant_id,
        "events": hunter_service.get_audit_events(
            tenant_id
        )
    }