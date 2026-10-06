from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from typing import Any

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Permission, Role, Tenant, Team, User, WorkflowStage, GovernanceWorkflow

AUTH_SECRET = os.getenv("AEGISAI_AUTH_SECRET", "aegisai-local-dev-secret-change-me")
SESSION_TTL_SECONDS = 60 * 60 * 8


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        200_000,
    )
    return f"pbkdf2_sha256$200000${salt}${digest.hex()}"


def verify_password(password: str, stored_hash: str | None) -> bool:
    if not stored_hash:
        return False

    if stored_hash.startswith("pbkdf2_sha256$"):
        try:
            _, iterations, salt, digest_hex = stored_hash.split("$")
            derived = hashlib.pbkdf2_hmac(
                "sha256",
                password.encode("utf-8"),
                salt.encode("utf-8"),
                int(iterations),
            )
            return hmac.compare_digest(derived.hex(), digest_hex)
        except (ValueError, TypeError):
            return False

    legacy_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        b"aegisai-dev-seed-salt",
        200_000,
    ).hex()
    return hmac.compare_digest(stored_hash, legacy_hash)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _b64url_decode(value: str) -> bytes:
    padded = value + "=" * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode(padded.encode("utf-8"))


def _token_signature(payload_json: str) -> str:
    return hmac.new(
        AUTH_SECRET.encode("utf-8"),
        payload_json.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def create_session_token(user: User, role_name: str | None = None) -> str:
    payload = {
        "sub": user.id,
        "tenant_id": user.tenant_id,
        "email": user.email,
        "role": role_name or "Tenant Admin",
        "exp": int(time.time()) + SESSION_TTL_SECONDS,
    }
    payload_json = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    return f"{_b64url_encode(payload_json.encode('utf-8'))}.{_token_signature(payload_json)}"


def verify_session_token(token: str) -> dict[str, Any]:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    try:
        payload_segment, signature = token.split(".", 1)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token.") from exc

    if not payload_segment or not signature:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token.")

    try:
        payload_bytes = _b64url_decode(payload_segment)
        payload_json = payload_bytes.decode("utf-8")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token.") from exc

    if not hmac.compare_digest(signature, _token_signature(payload_json)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token.")

    try:
        payload = json.loads(payload_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token.") from exc

    if int(payload.get("exp", 0)) < int(time.time()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired.")

    return payload


def invalidate_session_token(token: str | None) -> None:
    # Signed access tokens are stateless; client logout clears the token.
    return None


def get_current_user(
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
) -> User:
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()

    payload = verify_session_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token.")

    user = db.get(User, user_id)
    if user is None or user.status != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed.")

    return user


def get_current_tenant(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Tenant:
    tenant = db.get(Tenant, current_user.tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found.")
    return tenant


def normalize_email(email: str) -> str:
    return email.strip().lower()


def validate_password(password: str) -> None:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter.")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter.")
    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one number.")


def _ensure_permission(session: Session, tenant_id: str, code: str, description: str) -> Permission:
    permission = session.execute(
        select(Permission).where(Permission.tenant_id == tenant_id, Permission.code == code)
    ).scalar_one_or_none()
    if permission is None:
        permission = Permission(tenant_id=tenant_id, code=code, description=description)
        session.add(permission)
        session.flush()
    return permission


def _ensure_role(session: Session, tenant_id: str, role_name: str, description: str) -> Role:
    role = session.execute(
        select(Role).where(Role.tenant_id == tenant_id, Role.name == role_name)
    ).scalar_one_or_none()
    if role is None:
        role = Role(tenant_id=tenant_id, name=role_name, description=description)
        session.add(role)
        session.flush()
    return role


def _ensure_default_workflow(session: Session, tenant_id: str) -> GovernanceWorkflow:
    workflow = session.execute(
        select(GovernanceWorkflow).where(GovernanceWorkflow.tenant_id == tenant_id, GovernanceWorkflow.name == "Default Governance Workflow")
    ).scalar_one_or_none()
    if workflow is None:
        workflow = GovernanceWorkflow(tenant_id=tenant_id, name="Default Governance Workflow", status="active")
        session.add(workflow)
        session.flush()

    if not workflow.stages:
        teams = session.execute(select(Team).where(Team.tenant_id == tenant_id)).scalars().all()
        team_lookup = {team.name: team for team in teams}
        stage_sequence = [
            ("OPERATIONS_REVIEW", "Operations Review", "Operations Team"),
            ("RISK_REVIEW", "Risk Review", "Risk Team"),
            ("CREDIT_COMMITTEE_REVIEW", "Credit Committee Review", "Credit Committee"),
            ("FINAL_DECISION", "Final Decision", "Executive Decision Team"),
        ]
        for stage_order, (stage_type, _, team_name) in enumerate(stage_sequence, start=1):
            stage = WorkflowStage(
                workflow_id=workflow.id,
                stage_type=stage_type,
                stage_order=stage_order,
                team_id=team_lookup.get(team_name).id if team_name in team_lookup else None,
                status="active",
            )
            session.add(stage)
    return workflow


def create_tenant_admin_user(session: Session, organization_name: str, full_name: str, email: str, password: str) -> tuple[Tenant, User, Role]:
    normalized_email = normalize_email(email)

    if not organization_name.strip():
        raise ValueError("Organization name is required.")
    if not full_name.strip():
        raise ValueError("Full name is required.")
    if not normalized_email or "@" not in normalized_email:
        raise ValueError("A valid email is required.")

    validate_password(password)

    existing_user = session.execute(
        select(User).where(User.email == normalized_email)
    ).scalar_one_or_none()
    if existing_user is not None:
        raise ValueError("A user with that email already exists.")

    tenant = Tenant(organization_name=organization_name.strip(), status="active")
    session.add(tenant)
    session.flush()

    for code, description in {
        "view_application": "View applications in the tenant",
        "review_application": "Review applications",
        "escalate_application": "Escalate applications to a higher workflow stage",
        "make_final_decision": "Approve or reject final decisions",
        "manage_users": "Manage users in the tenant",
        "manage_workflow": "Manage the governance workflow",
        "view_audit_logs": "View audit logs",
    }.items():
        _ensure_permission(session, tenant.id, code, description)

    admin_role = _ensure_role(session, tenant.id, "Tenant Admin", "Administrative tenant owner")
    permission_list = session.execute(select(Permission).where(Permission.tenant_id == tenant.id)).scalars().all()
    admin_role.permissions = permission_list

    for name in ["Operations Team", "Risk Team", "Credit Committee", "Executive Decision Team"]:
        existing_team = session.execute(select(Team).where(Team.tenant_id == tenant.id, Team.name == name)).scalar_one_or_none()
        if existing_team is None:
            session.add(Team(tenant_id=tenant.id, name=name, description=f"{name} team", status="active"))
    session.flush()

    user = User(
        tenant_id=tenant.id,
        name=full_name.strip(),
        email=normalized_email,
        password_hash=hash_password(password),
        status="active",
        primary_role_id=admin_role.id,
    )
    session.add(user)
    session.flush()

    _ensure_default_workflow(session, tenant.id)
    session.flush()

    return tenant, user, admin_role
