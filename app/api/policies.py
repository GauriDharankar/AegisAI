from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.admin import _require_tenant_admin
from app.db.database import get_db
from app.db.models import AuditLog, Policy, PolicyVersion, Tenant, User, generate_id
from app.schemas.policies import PolicyWriteRequest
from app.services.auth_service import get_current_user
from app.services.datetime_service import serialize_utc_datetime

router = APIRouter(prefix="/api/v1/policies", tags=["Policies"])


def _latest_version(db: Session, policy_id: str) -> PolicyVersion | None:
    return db.execute(
        select(PolicyVersion)
        .where(PolicyVersion.policy_id == policy_id)
        .order_by(PolicyVersion.version_number.desc())
    ).scalars().first()


def _policy_rule(version: PolicyVersion | None) -> dict[str, Any]:
    return dict(version.rule_definition or {}) if version is not None else {}


def _serialize_policy(db: Session, policy: Policy) -> dict[str, Any]:
    version = _latest_version(db, policy.id)
    rule = _policy_rule(version)
    return {
        "id": policy.id,
        "code": policy.code,
        "name": policy.name,
        "description": policy.description,
        "enabled": policy.enabled,
        "field": rule.get("field"),
        "operator": rule.get("operator"),
        "value": rule.get("value"),
        "action": rule.get("action"),
        "severity": rule.get("severity"),
        "version_number": version.version_number if version is not None else None,
        "created_at": serialize_utc_datetime(policy.created_at),
        "updated_at": serialize_utc_datetime(policy.updated_at),
    }


def _rule_definition(policy: Policy, payload: PolicyWriteRequest) -> dict[str, Any]:
    return {
        "policy_id": policy.code,
        "name": payload.name.strip(),
        "description": payload.description,
        "field": payload.field.strip(),
        "operator": payload.operator,
        "value": payload.value,
        "action": payload.action,
        "severity": payload.severity,
        "enabled": payload.enabled,
    }


def _record_policy_audit(
    db: Session,
    tenant: Tenant,
    user: User,
    action: str,
    policy: Policy,
) -> None:
    db.add(
        AuditLog(
            tenant_id=tenant.id,
            actor_user_id=user.id,
            action=action,
            resource_type="policy",
            resource_id=policy.id,
            metadata_data={"policy_code": policy.code, "policy_name": policy.name},
        )
    )


def _require_own_policy(db: Session, tenant_id: str, policy_id: str) -> Policy:
    policy = db.execute(
        select(Policy).where(Policy.id == policy_id, Policy.tenant_id == tenant_id)
    ).scalar_one_or_none()
    if policy is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found.")
    return policy


@router.get("")
def list_policies(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    policies = db.execute(
        select(Policy)
        .where(Policy.tenant_id == current_user.tenant_id)
        .order_by(Policy.created_at, Policy.id)
    ).scalars().all()
    return [_serialize_policy(db, policy) for policy in policies]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_policy(
    payload: PolicyWriteRequest,
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    current_user, tenant = admin_context
    policy_id = generate_id("POL")
    policy = Policy(
        id=policy_id,
        tenant_id=tenant.id,
        name=payload.name.strip(),
        code=policy_id,
        description=payload.description,
        enabled=payload.enabled,
    )
    db.add(policy)
    db.flush()
    db.add(
        PolicyVersion(
            policy_id=policy.id,
            version_number=1,
            rule_definition=_rule_definition(policy, payload),
        )
    )
    _record_policy_audit(db, tenant, current_user, "POLICY_CREATED", policy)
    db.commit()
    db.refresh(policy)
    return _serialize_policy(db, policy)


@router.put("/{policy_id}")
def update_policy(
    policy_id: str,
    payload: PolicyWriteRequest,
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    current_user, tenant = admin_context
    policy = _require_own_policy(db, tenant.id, policy_id)
    latest = _latest_version(db, policy.id)
    policy.name = payload.name.strip()
    policy.description = payload.description
    policy.enabled = payload.enabled
    db.add(
        PolicyVersion(
            policy_id=policy.id,
            version_number=(latest.version_number + 1) if latest is not None else 1,
            rule_definition=_rule_definition(policy, payload),
        )
    )
    _record_policy_audit(db, tenant, current_user, "POLICY_UPDATED", policy)
    db.commit()
    db.refresh(policy)
    return _serialize_policy(db, policy)


@router.delete("/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_policy(
    policy_id: str,
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> Response:
    current_user, tenant = admin_context
    policy = _require_own_policy(db, tenant.id, policy_id)
    _record_policy_audit(db, tenant, current_user, "POLICY_DELETED", policy)
    db.delete(policy)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
