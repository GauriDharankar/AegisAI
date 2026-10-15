from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import PlatformAuditLog, Tenant, User, utcnow
from app.services.auth_service import require_platform_admin

router = APIRouter(prefix="/api/v1/platform-admin", tags=["Platform Admin"])

VERIFICATION_TRANSITIONS = {
    "PENDING": {"UNDER_REVIEW"},
    "UNDER_REVIEW": {"VERIFIED", "REJECTED", "INFORMATION_REQUIRED"},
    "INFORMATION_REQUIRED": {"UNDER_REVIEW"},
    "REJECTED": {"UNDER_REVIEW"},
    "VERIFIED": set(),
}


class TenantListItem(BaseModel):
    id: str
    organization_name: str
    status: str
    verification_status: str
    registration_number: str | None
    verification_reviewed_at: datetime | None
    verification_reviewer_id: str | None
    verification_reason: str | None
    created_at: datetime


class TenantVerificationDetails(BaseModel):
    id: str
    organization_name: str
    status: str
    verification_status: str
    registration_number: str | None
    verification_reviewed_at: datetime | None
    verification_reviewer_id: str | None
    verification_reason: str | None


class TenantAccountStatus(BaseModel):
    id: str
    organization_name: str
    status: str
    verification_status: str


class PlatformActivityItem(BaseModel):
    id: str
    actor_user_id: str
    tenant_id: str
    action: str
    resource_type: str
    resource_id: str
    timestamp: datetime
    metadata: dict[str, Any]


class VerificationReasonRequest(BaseModel):
    reason: str = Field(..., min_length=1)

    @field_validator("reason")
    @classmethod
    def reason_must_not_be_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Reason must not be blank.")
        return cleaned


def _get_tenant_or_404(db: Session, tenant_id: str) -> Tenant:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found.")
    return tenant


def _record_platform_activity(
    db: Session,
    actor: User,
    tenant: Tenant,
    action: str,
    metadata: dict[str, Any],
) -> None:
    db.add(
        PlatformAuditLog(
            actor_user_id=actor.id,
            tenant_id=tenant.id,
            action=action,
            resource_type="tenant",
            resource_id=tenant.id,
            metadata_data=metadata,
        )
    )


def _change_verification_status(
    db: Session,
    tenant: Tenant,
    reviewer: User,
    new_status: str,
    reason: str | None = None,
) -> TenantVerificationDetails:
    allowed = VERIFICATION_TRANSITIONS.get(tenant.verification_status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot transition verification from {tenant.verification_status} to {new_status}.",
        )

    previous_status = tenant.verification_status
    tenant.verification_status = new_status
    tenant.verification_reviewed_at = utcnow()
    tenant.verification_reviewer_id = reviewer.id
    tenant.verification_reason = reason
    action_by_status = {
        "UNDER_REVIEW": "tenant_verification_review_started",
        "VERIFIED": "tenant_verification_approved",
        "REJECTED": "tenant_verification_rejected",
        "INFORMATION_REQUIRED": "tenant_verification_information_requested",
    }
    metadata: dict[str, Any] = {
        "status_type": "verification",
        "previous_status": previous_status,
        "new_status": new_status,
    }
    if reason is not None:
        metadata["reason"] = reason
    _record_platform_activity(db, reviewer, tenant, action_by_status[new_status], metadata)
    db.commit()
    db.refresh(tenant)
    return TenantVerificationDetails.model_validate(tenant, from_attributes=True)


@router.get("/activity", response_model=list[PlatformActivityItem])
def list_platform_activity(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _platform_admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
) -> list[PlatformActivityItem]:
    logs = db.execute(
        select(PlatformAuditLog)
        .order_by(PlatformAuditLog.timestamp.desc(), PlatformAuditLog.id.desc())
        .offset(offset)
        .limit(limit)
    ).scalars().all()
    return [
        PlatformActivityItem(
            id=log.id,
            actor_user_id=log.actor_user_id,
            tenant_id=log.tenant_id,
            action=log.action,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            timestamp=log.timestamp,
            metadata=log.metadata_data or {},
        )
        for log in logs
    ]


@router.get("/tenants", response_model=list[TenantListItem])
def list_tenants(
    _platform_admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
) -> list[Tenant]:
    registered_tenant = (
        select(User.id)
        .where(User.tenant_id == Tenant.id, User.is_platform_admin.is_(False))
        .exists()
    )
    return db.execute(
        select(Tenant)
        .where(registered_tenant)
        .order_by(Tenant.created_at.desc(), Tenant.id)
    ).scalars().all()


@router.get("/tenants/{tenant_id}/verification", response_model=TenantVerificationDetails)
def get_tenant_verification(
    tenant_id: str,
    _platform_admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
) -> TenantVerificationDetails:
    tenant = _get_tenant_or_404(db, tenant_id)
    return TenantVerificationDetails.model_validate(tenant, from_attributes=True)


@router.post("/tenants/{tenant_id}/verification/review", response_model=TenantVerificationDetails)
def mark_tenant_under_review(
    tenant_id: str,
    platform_admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
) -> TenantVerificationDetails:
    tenant = _get_tenant_or_404(db, tenant_id)
    return _change_verification_status(db, tenant, platform_admin, "UNDER_REVIEW")


@router.post("/tenants/{tenant_id}/verification/approve", response_model=TenantVerificationDetails)
def approve_tenant_verification(
    tenant_id: str,
    platform_admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
) -> TenantVerificationDetails:
    tenant = _get_tenant_or_404(db, tenant_id)
    return _change_verification_status(db, tenant, platform_admin, "VERIFIED")


@router.post("/tenants/{tenant_id}/verification/reject", response_model=TenantVerificationDetails)
def reject_tenant_verification(
    tenant_id: str,
    payload: VerificationReasonRequest,
    platform_admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
) -> TenantVerificationDetails:
    tenant = _get_tenant_or_404(db, tenant_id)
    return _change_verification_status(db, tenant, platform_admin, "REJECTED", payload.reason)


@router.post("/tenants/{tenant_id}/verification/request-information", response_model=TenantVerificationDetails)
def request_tenant_information(
    tenant_id: str,
    payload: VerificationReasonRequest,
    platform_admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
) -> TenantVerificationDetails:
    tenant = _get_tenant_or_404(db, tenant_id)
    return _change_verification_status(
        db,
        tenant,
        platform_admin,
        "INFORMATION_REQUIRED",
        payload.reason,
    )


@router.post("/tenants/{tenant_id}/activate", response_model=TenantAccountStatus)
def activate_tenant(
    tenant_id: str,
    platform_admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
) -> TenantAccountStatus:
    tenant = _get_tenant_or_404(db, tenant_id)
    if tenant.verification_status != "VERIFIED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tenant must be verified before it can be activated.",
        )
    if tenant.status != "inactive":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot activate tenant with account status {tenant.status}.",
        )

    previous_status = tenant.status
    tenant.status = "active"
    _record_platform_activity(
        db,
        platform_admin,
        tenant,
        "tenant_activated",
        {
            "status_type": "account",
            "previous_status": previous_status,
            "new_status": tenant.status,
        },
    )
    db.commit()
    db.refresh(tenant)
    return TenantAccountStatus.model_validate(tenant, from_attributes=True)


@router.post("/tenants/{tenant_id}/deactivate", response_model=TenantAccountStatus)
def deactivate_tenant(
    tenant_id: str,
    platform_admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
) -> TenantAccountStatus:
    tenant = _get_tenant_or_404(db, tenant_id)
    if tenant.status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot deactivate tenant with account status {tenant.status}.",
        )

    previous_status = tenant.status
    tenant.status = "inactive"
    _record_platform_activity(
        db,
        platform_admin,
        tenant,
        "tenant_deactivated",
        {
            "status_type": "account",
            "previous_status": previous_status,
            "new_status": tenant.status,
        },
    )
    db.commit()
    db.refresh(tenant)
    return TenantAccountStatus.model_validate(tenant, from_attributes=True)
