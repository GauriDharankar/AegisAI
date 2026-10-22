from __future__ import annotations

from datetime import datetime, timedelta
import hashlib
import hmac
import secrets
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_serializer, field_validator
from sqlalchemy import desc, select, update
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import (
    PasswordResetChallenge,
    PlatformAdmin,
    PlatformAuditLog,
    Tenant,
    User,
    generate_id,
    utcnow,
)
from app.services.auth_service import (
    create_session_token,
    hash_password,
    normalize_email,
    require_platform_admin,
    validate_password,
    verify_password,
)
from app.services.datetime_service import serialize_utc_datetime
from app.services.phone_service import (
    PhoneConfigurationError,
    decrypt_phone_number,
    hash_password_reset_value,
    hash_phone_number,
    normalize_phone_number,
)
from app.services.sms_provider import (
    SmsConfigurationError,
    SmsDeliveryError,
    get_sms_provider,
)

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

    @field_serializer("verification_reviewed_at", "created_at")
    def serialize_timestamps(self, value: datetime | None) -> str | None:
        return serialize_utc_datetime(value)


class TenantVerificationDetails(BaseModel):
    id: str
    organization_name: str
    status: str
    verification_status: str
    registration_number: str | None
    verification_reviewed_at: datetime | None
    verification_reviewer_id: str | None
    verification_reason: str | None

    @field_serializer("verification_reviewed_at")
    def serialize_reviewed_at(self, value: datetime | None) -> str | None:
        return serialize_utc_datetime(value)


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

    @field_serializer("timestamp")
    def serialize_timestamp(self, value: datetime) -> str | None:
        return serialize_utc_datetime(value)


class VerificationReasonRequest(BaseModel):
    reason: str = Field(..., min_length=1)

    @field_validator("reason")
    @classmethod
    def reason_must_not_be_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Reason must not be blank.")
        return cleaned


class PlatformAdminLoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)


class PasswordResetPhoneRequest(BaseModel):
    phone_number: str = Field(..., min_length=8, max_length=32)

    @field_validator("phone_number")
    @classmethod
    def phone_number_must_be_e164(cls, value: str) -> str:
        return normalize_phone_number(value)


class PasswordResetVerifyRequest(PasswordResetPhoneRequest):
    code: str = Field(..., pattern=r"^[0-9]{6}$")


class PasswordResetConfirmRequest(BaseModel):
    reset_token: str = Field(..., min_length=32, max_length=128)
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)


def _record_password_event(db: Session, user: User, action: str) -> None:
    db.add(
        PlatformAuditLog(
            actor_user_id=user.id,
            tenant_id=user.tenant_id,
            action=action,
            resource_type="platform_admin_account",
            resource_id=user.id,
            metadata_data={},
        )
    )


def _is_expired(expires_at: datetime, now: datetime) -> bool:
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=now.tzinfo)
    return expires_at < now


@router.post("/login")
def platform_admin_login(payload: PlatformAdminLoginRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Enter a valid email address.")
    user = db.execute(
        select(User)
        .join(PlatformAdmin, PlatformAdmin.user_id == User.id)
        .where(
            User.email == email,
            User.is_platform_admin.is_(True),
            User.status == "active",
        )
    ).scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    tenant = db.get(Tenant, user.tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed.")
    token = create_session_token(user, role_name="Super Admin")
    return {
        "message": "Login successful.",
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": "Super Admin",
            "tenant_id": user.tenant_id,
            "tenant_name": tenant.organization_name,
            "level": 5,
            "tenant_status": tenant.status,
            "verification_status": tenant.verification_status,
            "verification_reason": tenant.verification_reason,
            "tenant_created_at": serialize_utc_datetime(tenant.created_at),
            "teams": [],
            "responsibilities": [],
        },
    }


@router.post("/password/change")
def change_platform_admin_password(
    payload: ChangePasswordRequest,
    platform_admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, platform_admin.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New passwords do not match.")
    try:
        validate_password(payload.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if verify_password(payload.new_password, platform_admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password.",
        )

    platform_admin.password_hash = hash_password(payload.new_password)
    platform_admin.session_version += 1
    now = utcnow()
    db.execute(
        update(PasswordResetChallenge)
        .where(PasswordResetChallenge.user_id == platform_admin.id)
        .values(expires_at=now, reset_token_hash=None, reset_expires_at=now)
        .execution_options(synchronize_session=False)
    )
    _record_password_event(db, platform_admin, "platform_admin_password_changed")
    db.commit()
    return {"message": "Password changed successfully. Sign in again."}


@router.post("/password-reset/start", status_code=status.HTTP_202_ACCEPTED)
def start_platform_admin_password_reset(
    payload: PasswordResetPhoneRequest,
    db: Session = Depends(get_db),
):
    try:
        provider = get_sms_provider()
        phone_hash = hash_phone_number(payload.phone_number)
    except (PhoneConfigurationError, SmsConfigurationError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    user = db.execute(
        select(User)
        .join(PlatformAdmin, PlatformAdmin.user_id == User.id)
        .where(
            User.phone_number_hash == phone_hash,
            User.phone_verified_at.is_not(None),
            User.is_platform_admin.is_(True),
            User.status == "active",
        )
        .limit(1)
    ).scalar_one_or_none()
    response = {
        "message": "If this number is registered and eligible, a code will be sent after any security cooldown.",
    }
    if user is None:
        return response

    if user.phone_number_encrypted is None:
        return response
    try:
        registered_phone = decrypt_phone_number(user.phone_number_encrypted)
    except PhoneConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Platform Admin phone recovery is temporarily unavailable.",
        ) from exc

    now = utcnow()
    recent_challenges = db.execute(
        select(PasswordResetChallenge)
        .where(
            PasswordResetChallenge.user_id == user.id,
            PasswordResetChallenge.created_at >= now - timedelta(hours=1),
        )
        .order_by(desc(PasswordResetChallenge.created_at))
    ).scalars().all()
    if len(recent_challenges) >= 3:
        return response
    if recent_challenges:
        newest_created_at = recent_challenges[0].created_at
        if newest_created_at.tzinfo is None:
            newest_created_at = newest_created_at.replace(tzinfo=now.tzinfo)
        if (now - newest_created_at).total_seconds() < 60:
            return response

    for challenge in recent_challenges:
        challenge.expires_at = now
        challenge.reset_token_hash = None
        challenge.reset_expires_at = now

    challenge_id = generate_id("PRC")
    code = f"{secrets.randbelow(1_000_000):06d}"
    challenge = PasswordResetChallenge(
        id=challenge_id,
        user_id=user.id,
        phone_number_hash=phone_hash,
        code_hash=hash_password_reset_value(f"{challenge_id}:{code}", "otp"),
        created_at=now,
        expires_at=now.replace(microsecond=0) + timedelta(minutes=10),
        attempts=0,
        delivery_status="pending",
    )
    db.add(challenge)
    db.flush()

    try:
        delivery = provider.send_otp(registered_phone, code)
    except SmsDeliveryError as exc:
        challenge.delivery_status = "failed"
        challenge.expires_at = now
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The verification code could not be delivered. Please try again later.",
        ) from exc

    challenge.delivery_status = "sent"
    db.commit()
    if delivery.development_code is not None:
        response["development_otp"] = delivery.development_code
        response["message"] = "Development-only test code generated."
    return response


@router.post("/password-reset/verify")
def verify_platform_admin_password_reset_code(
    payload: PasswordResetVerifyRequest,
    db: Session = Depends(get_db),
):
    try:
        phone_hash = hash_phone_number(payload.phone_number)
    except PhoneConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Platform Admin phone recovery is temporarily unavailable.",
        ) from exc
    user = db.execute(
        select(User)
        .join(PlatformAdmin, PlatformAdmin.user_id == User.id)
        .where(
            User.phone_number_hash == phone_hash,
            User.phone_verified_at.is_not(None),
            User.is_platform_admin.is_(True),
            User.status == "active",
        )
        .limit(1)
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification code.")

    challenge = db.execute(
        select(PasswordResetChallenge)
        .where(PasswordResetChallenge.user_id == user.id)
        .order_by(desc(PasswordResetChallenge.created_at))
        .limit(1)
    ).scalar_one_or_none()
    now = utcnow()
    if (
        challenge is None
        or challenge.delivery_status != "sent"
        or challenge.phone_number_hash != user.phone_number_hash
        or challenge.otp_used_at is not None
        or _is_expired(challenge.expires_at, now)
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification code.")
    if challenge.attempts >= 5:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many verification attempts. Request a new code later.")
    supplied_hash = hash_password_reset_value(f"{challenge.id}:{payload.code}", "otp")
    attempt_update = db.execute(
        update(PasswordResetChallenge)
        .where(
            PasswordResetChallenge.id == challenge.id,
            PasswordResetChallenge.attempts < 5,
            PasswordResetChallenge.otp_used_at.is_(None),
            PasswordResetChallenge.delivery_status == "sent",
            PasswordResetChallenge.expires_at > now,
        )
        .values(attempts=PasswordResetChallenge.attempts + 1)
        .execution_options(synchronize_session=False)
    )
    if attempt_update.rowcount != 1:
        db.rollback()
        current_challenge = db.get(PasswordResetChallenge, challenge.id)
        if current_challenge is not None and current_challenge.attempts >= 5:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many verification attempts. Request a new code later.",
            )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification code.")
    db.commit()
    db.refresh(challenge)
    if challenge is None or challenge.otp_used_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification code.")
    if not hmac.compare_digest(supplied_hash, challenge.code_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification code.")

    reset_token = secrets.token_urlsafe(32)
    consume_update = db.execute(
        update(PasswordResetChallenge)
        .where(
            PasswordResetChallenge.id == challenge.id,
            PasswordResetChallenge.otp_used_at.is_(None),
            PasswordResetChallenge.expires_at > now,
        )
        .values(
            otp_used_at=now,
            reset_token_hash=hashlib.sha256(reset_token.encode("ascii")).hexdigest(),
            reset_expires_at=now.replace(microsecond=0) + timedelta(minutes=15),
        )
        .execution_options(synchronize_session=False)
    )
    if consume_update.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification code.")
    db.commit()
    return {"reset_token": reset_token}


@router.post("/password-reset/confirm")
def confirm_platform_admin_password_reset(
    payload: PasswordResetConfirmRequest,
    db: Session = Depends(get_db),
):
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New passwords do not match.")
    try:
        validate_password(payload.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    token_hash = hashlib.sha256(payload.reset_token.encode("utf-8")).hexdigest()
    challenge = db.execute(
        select(PasswordResetChallenge)
        .where(
            PasswordResetChallenge.reset_token_hash == token_hash,
            PasswordResetChallenge.reset_used_at.is_(None),
        )
        .limit(1)
    ).scalar_one_or_none()
    now = utcnow()
    if (
        challenge is None
        or challenge.reset_expires_at is None
        or _is_expired(challenge.reset_expires_at, now)
        or challenge.otp_used_at is None
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired password reset session.")

    user = db.get(User, challenge.user_id)
    if (
        user is None
        or not user.is_platform_admin
        or challenge.phone_number_hash != user.phone_number_hash
        or db.execute(
            select(PlatformAdmin).where(PlatformAdmin.user_id == user.id)
        ).scalar_one_or_none() is None
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired password reset session.")
    consume_update = db.execute(
        update(PasswordResetChallenge)
        .where(
            PasswordResetChallenge.id == challenge.id,
            PasswordResetChallenge.reset_used_at.is_(None),
            PasswordResetChallenge.reset_expires_at > now,
        )
        .values(reset_used_at=now)
        .execution_options(synchronize_session=False)
    )
    if consume_update.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired password reset session.")
    db.execute(
        update(PasswordResetChallenge)
        .where(
            PasswordResetChallenge.user_id == user.id,
            PasswordResetChallenge.id != challenge.id,
        )
        .values(expires_at=now, reset_token_hash=None, reset_expires_at=now)
        .execution_options(synchronize_session=False)
    )
    user.password_hash = hash_password(payload.new_password)
    user.session_version += 1
    _record_password_event(db, user, "platform_admin_password_reset")
    db.commit()
    return {"message": "Password reset successfully. Sign in with your new password."}


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
