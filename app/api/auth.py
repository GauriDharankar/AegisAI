from __future__ import annotations

import re

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import AuditLog, Role, TeamMember, Tenant, User
from app.services.auth_service import (
    create_session_token,
    create_tenant_admin_user,
    get_current_tenant,
    get_current_user,
    invalidate_session_token,
    normalize_email,
    verify_password,
)

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    organization_name: str = Field(..., min_length=2)
    name: str = Field(..., min_length=2)
    email: EmailStr
    password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)


class LoginRequest(BaseModel):
    # Development seed accounts use reserved .local domains.
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1)


def _serialize_user_assignments(db: Session, user: User) -> dict:
    memberships = db.query(TeamMember).filter(TeamMember.user_id == user.id).all()
    return {
        "teams": [
            {
                "id": membership.team.id,
                "name": membership.team.name,
                "role": membership.role.name if membership.role else None,
            }
            for membership in memberships
        ],
        "responsibilities": sorted(
            {
                *(
                    [user.primary_role.name]
                    if user.primary_role is not None
                    else []
                ),
                *[
                    membership.role.name
                    for membership in memberships
                    if membership.role is not None
                ],
            }
        ),
    }


@router.post("/register")
def register_organization(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
):
    organization_name = payload.organization_name.strip()
    full_name = payload.name.strip()
    email = normalize_email(payload.email)

    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match.")

    try:
        tenant, user, role = create_tenant_admin_user(
            db,
            organization_name=organization_name,
            full_name=full_name,
            email=email,
            password=payload.password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    db.add(
        AuditLog(
            tenant_id=tenant.id,
            actor_user_id=user.id,
            action="organization_registered",
            resource_type="tenant",
            resource_id=tenant.id,
            metadata_data={
                "organization_name": organization_name,
                "created_by": user.email,
            },
        )
    )
    db.commit()

    token = create_session_token(user, role_name=role.name)
    current_role_name = role.name
    return {
        "message": "Organization registered successfully.",
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": current_role_name,
            "tenant_id": user.tenant_id,
            "level": 4,
        },
        "tenant": {
            "id": tenant.id,
            "organization_name": tenant.organization_name,
            "status": tenant.status,
        },
    }


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Enter a valid email address.")

    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your account is inactive. Contact your organization administrator.",
        )

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    role = db.get(Role, user.primary_role_id)
    token = create_session_token(user, role_name=role.name if role else "Tenant Admin")
    assignments = _serialize_user_assignments(db, user)

    return {
        "message": "Login successful.",
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": (role.name if role else "Tenant Admin"),
            "tenant_id": user.tenant_id,
            "level": 4 if (role and role.name == "Tenant Admin") else 2,
            **assignments,
        },
        "tenant": {
            "id": user.tenant_id,
            "organization_name": db.get(Tenant, user.tenant_id).organization_name if db.get(Tenant, user.tenant_id) else "",
        },
    }


@router.post("/logout")
def logout(
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()

    invalidate_session_token(token)
    return {"message": "Logged out successfully."}


@router.post("/refresh")
def refresh_session(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role = db.get(Role, current_user.primary_role_id)
    token = create_session_token(current_user, role_name=role.name if role else "Tenant Admin")
    tenant = db.get(Tenant, current_user.tenant_id)
    assignments = _serialize_user_assignments(db, current_user)
    return {
        "message": "Session refreshed.",
        "token": token,
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "role": role.name if role else "Tenant Admin",
            "tenant_id": current_user.tenant_id,
            "tenant_name": tenant.organization_name if tenant else None,
            "level": 4 if (role and role.name == "Tenant Admin") else 2,
            **assignments,
        },
    }


@router.get("/me")
def get_current_identity(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tenant = db.get(Tenant, current_user.tenant_id)
    role = db.get(Role, current_user.primary_role_id)
    assignments = _serialize_user_assignments(db, current_user)

    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": role.name if role else "Tenant Admin",
        "tenant_id": current_user.tenant_id,
        "tenant_name": tenant.organization_name if tenant else None,
        "level": 4 if (role and role.name == "Tenant Admin") else 2,
        **assignments,
    }


@router.get("/health")
def health():
    return {"status": "ok"}
