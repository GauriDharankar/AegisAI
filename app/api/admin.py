from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import (
    AuditLog,
    GovernanceWorkflow,
    Role,
    Team,
    TeamMember,
    Tenant,
    User,
    WorkflowStage,
)
from app.schemas.governance import AutoApproveConfig
from app.services.auth_service import get_current_user, hash_password, normalize_email, validate_password

router = APIRouter(prefix="/api/v1/admin", tags=["Tenant Admin"])

VALID_RESPONSIBILITIES = {
    "TENANT_ADMIN": "Tenant Admin",
    "OPERATIONS_REVIEWER": "Operations Reviewer",
    "RISK_REVIEWER": "Risk Reviewer",
    "CREDIT_COMMITTEE_REVIEWER": "Credit Committee Reviewer",
    "FINAL_DECISION_MAKER": "Final Decision Maker",
}

ROLE_CONFLICTS = {
    "Operations Reviewer": {"Final Decision Maker"},
    "Risk Reviewer": {"Final Decision Maker"},
    "Credit Committee Reviewer": {"Final Decision Maker"},
}

VALID_TEAM_STATUSES = {"active", "inactive"}
VALID_STAGE_TYPES = {
    "OPERATIONS_REVIEW",
    "RISK_REVIEW",
    "CREDIT_COMMITTEE_REVIEW",
    "FINAL_DECISION",
}
REVIEW_STAGE_TYPES = {"OPERATIONS_REVIEW", "RISK_REVIEW", "CREDIT_COMMITTEE_REVIEW"}


class OrganizationUpdateRequest(BaseModel):
    organization_name: str | None = Field(default=None, min_length=2)
    status: str | None = Field(default=None, min_length=2)


class TeamCreateRequest(BaseModel):
    name: str = Field(..., min_length=2)
    description: str | None = None
    status: str = "active"


class TeamUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2)
    description: str | None = None
    status: str | None = None


class UserCreateRequest(BaseModel):
    name: str = Field(..., min_length=2)
    email: EmailStr
    password: str = Field(..., min_length=8)
    status: str = "active"
    responsibilities: list[str] = Field(default_factory=list)
    team_ids: list[str] = Field(default_factory=list)
    tenant_id: str | None = None


class TeamAssignmentRequest(BaseModel):
    team_id: str = Field(..., min_length=1)
    role: str | None = None


class ResponsibilityRequest(BaseModel):
    responsibility: str = Field(..., min_length=2)


class UserStatusRequest(BaseModel):
    status: str = Field(..., min_length=2)


class WorkflowStageRequest(BaseModel):
    stage_type: str = Field(..., min_length=2)
    team_id: str | None = None
    status: str = "active"
    stage_order: int | None = None


class WorkflowRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2)
    status: str = "active"
    stages: list[WorkflowStageRequest] | None = None


class TenantConfigurationRequest(BaseModel):
    auto_approve: AutoApproveConfig


def _default_auto_approve_configuration() -> dict[str, Any]:
    return AutoApproveConfig().model_dump()


def _tenant_configuration(tenant: Tenant) -> dict[str, Any]:
    configuration = dict(tenant.governance_configuration or {})
    auto_approve = dict(configuration.get("auto_approve") or {})
    defaults = _default_auto_approve_configuration()
    defaults.update(auto_approve)
    return {"auto_approve": defaults}


def _canonicalize_responsibility(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    normalized = re.sub(r"[^A-Za-z0-9]+", "_", cleaned).upper()
    return VALID_RESPONSIBILITIES.get(normalized)


def _ensure_role_for_tenant(db: Session, tenant_id: str, role_name: str) -> Role:
    existing = db.execute(
        select(Role).where(Role.tenant_id == tenant_id, Role.name == role_name)
    ).scalar_one_or_none()
    if existing is not None:
        return existing

    role = Role(tenant_id=tenant_id, name=role_name, description=f"{role_name} access")
    db.add(role)
    db.flush()
    return role


def _serialize_team(team: Team) -> dict[str, Any]:
    return {
        "id": team.id,
        "tenant_id": team.tenant_id,
        "name": team.name,
        "description": team.description,
        "status": team.status,
        "member_count": len(team.members),
        "members": [
            {
                "id": member.user.id,
                "name": member.user.name,
                "email": member.user.email,
                "status": member.user.status,
                "role": member.role.name if member.role else None,
            }
            for member in team.members
        ],
    }


def _serialize_user(user: User, db: Session) -> dict[str, Any]:
    primary_role = db.get(Role, user.primary_role_id)
    memberships = db.execute(
        select(TeamMember).where(TeamMember.user_id == user.id).order_by(TeamMember.created_at)
    ).scalars().all()
    team_entries = []
    for membership in memberships:
        team = db.get(Team, membership.team_id)
        if team is not None:
            team_entries.append({
                "id": team.id,
                "name": team.name,
                "status": team.status,
                "role": membership.role.name if membership.role else None,
            })

    responsibilities = sorted(
        {
            (primary_role.name if primary_role else "Operations Reviewer"),
            *[
                membership.role.name
                for membership in memberships
                if membership.role is not None and membership.role.name
            ],
        }
    )

    return {
        "id": user.id,
        "tenant_id": user.tenant_id,
        "name": user.name,
        "email": user.email,
        "status": user.status,
        "primary_role": primary_role.name if primary_role else "Operations Reviewer",
        "responsibilities": responsibilities,
        "teams": team_entries,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def _require_tenant_admin(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> tuple[User, Tenant]:
    tenant = db.get(Tenant, current_user.tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found.")

    primary_role = db.get(Role, current_user.primary_role_id) if current_user.primary_role_id else None
    if primary_role is None or primary_role.name != "Tenant Admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant admin access required.")

    return current_user, tenant


def _require_own_user(db: Session, tenant: Tenant, user_id: str) -> User:
    user = db.get(User, user_id)
    if user is None or user.tenant_id != tenant.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return user


def _require_own_team(db: Session, tenant: Tenant, team_id: str) -> Team:
    team = db.get(Team, team_id)
    if team is None or team.tenant_id != tenant.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found.")
    return team


def _responsibility_warnings(existing_roles: set[str], new_role: str) -> list[str]:
    warnings: list[str] = []
    if new_role in ROLE_CONFLICTS:
        conflicts = ROLE_CONFLICTS[new_role]
        if existing_roles & conflicts:
            warnings.append(
                f"Warning: assigning {new_role} alongside {sorted(existing_roles & conflicts)[0]} may create a review conflict."
            )
    return warnings


def _record_workflow_audit(
    db: Session,
    tenant: Tenant,
    actor_user: User,
    action: str,
    workflow: GovernanceWorkflow,
    details: dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditLog(
            tenant_id=tenant.id,
            actor_user_id=actor_user.id,
            action=action,
            resource_type="workflow",
            resource_id=workflow.id,
            metadata_data={
                "workflow_id": workflow.id,
                "workflow_name": workflow.name,
                **(details or {}),
            },
        )
    )


def _serialize_workflow_stage(stage: WorkflowStage) -> dict[str, Any]:
    return {
        "id": stage.id,
        "workflow_id": stage.workflow_id,
        "stage_type": stage.stage_type,
        "status": stage.status,
        "stage_order": stage.stage_order,
        "team_id": stage.team_id,
        "team_name": stage.team.name if stage.team else None,
        "created_at": stage.created_at.isoformat(),
        "updated_at": stage.updated_at.isoformat(),
    }


def _serialize_workflow(workflow: GovernanceWorkflow) -> dict[str, Any]:
    ordered = sorted(workflow.stages, key=lambda stage: stage.stage_order)
    return {
        "id": workflow.id,
        "tenant_id": workflow.tenant_id,
        "name": workflow.name,
        "status": workflow.status,
        "created_at": workflow.created_at.isoformat(),
        "updated_at": workflow.updated_at.isoformat(),
        "stages": [_serialize_workflow_stage(stage) for stage in ordered],
    }


def _ensure_tenant_workflow(db: Session, tenant_id: str) -> GovernanceWorkflow:
    workflow = db.execute(
        select(GovernanceWorkflow).where(GovernanceWorkflow.tenant_id == tenant_id).order_by(GovernanceWorkflow.created_at)
    ).scalar_one_or_none()
    if workflow is None:
        workflow = GovernanceWorkflow(tenant_id=tenant_id, name="Default Governance Workflow", status="active")
        db.add(workflow)
        db.flush()
    return workflow


def _validate_workflow(db: Session, workflow: GovernanceWorkflow, tenant: Tenant) -> None:
    stages = sorted(workflow.stages, key=lambda stage: stage.stage_order)
    order_values = [stage.stage_order for stage in stages]
    if len(order_values) != len(set(order_values)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workflow stage orders must be unique.")

    if not stages:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workflow must contain at least one stage.")

    for stage in stages:
        if stage.stage_type not in VALID_STAGE_TYPES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid stage type: {stage.stage_type}")
        if stage.team_id is not None:
            team = db.get(Team, stage.team_id)
            if team is None or team.tenant_id != tenant.id:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found in this tenant.")
            if team.status != "active":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Team {team.name} is inactive and cannot be assigned.")
        if stage.status not in VALID_TEAM_STATUSES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid stage status for {stage.stage_type}.")

    final_count = sum(1 for stage in stages if stage.stage_type == "FINAL_DECISION" and stage.status == "active")
    if final_count != 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Exactly one active Final Decision stage is required.")

    review_before_final = False
    final_stage = next((stage for stage in stages if stage.stage_type == "FINAL_DECISION" and stage.status == "active"), None)
    if final_stage is not None:
        review_before_final = any(
            stage.stage_type in REVIEW_STAGE_TYPES and stage.status == "active" and stage.stage_order < final_stage.stage_order
            for stage in stages
        )
    if not review_before_final:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one review stage is required before the Final Decision stage.")


def _prepare_stages_for_workflow(db: Session, tenant: Tenant, stages: list[WorkflowStageRequest] | None) -> list[WorkflowStage]:
    if stages is None:
        return []

    prepared: list[WorkflowStage] = []
    for index, entry in enumerate(stages, start=1):
        stage_type = entry.stage_type.strip().upper()
        if stage_type not in VALID_STAGE_TYPES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid stage type: {entry.stage_type}")

        team_id = entry.team_id.strip() if entry.team_id else None
        if team_id is not None:
            team = db.get(Team, team_id)
            if team is None or team.tenant_id != tenant.id:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found in this tenant.")
            if team.status != "active":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Team {team.name} is inactive and cannot be assigned.")

        if entry.status not in VALID_TEAM_STATUSES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid stage status: {entry.status}")

        ordered_value = index if entry.stage_order is None else int(entry.stage_order)
        prepared.append(
            WorkflowStage(
                stage_type=stage_type,
                team_id=team_id,
                status=entry.status,
                stage_order=ordered_value,
            )
        )
    return prepared


@router.get("/organization")
def get_organization(
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _, tenant = admin_context
    users = db.execute(select(User).where(User.tenant_id == tenant.id)).scalars().all()
    teams = db.execute(select(Team).where(Team.tenant_id == tenant.id)).scalars().all()
    return {
        "id": tenant.id,
        "organization_name": tenant.organization_name,
        "status": tenant.status,
        "created_at": tenant.created_at.isoformat(),
        "updated_at": tenant.updated_at.isoformat(),
        "user_count": len(users),
        "team_count": len(teams),
        "active_users": sum(1 for user in users if user.status == "active"),
    }


@router.get("/configuration")
def get_configuration(
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
) -> dict[str, Any]:
    _, tenant = admin_context
    return {"tenant_id": tenant.id, **_tenant_configuration(tenant)}


@router.put("/configuration")
def update_configuration(
    payload: TenantConfigurationRequest,
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _, tenant = admin_context
    tenant.governance_configuration = {"auto_approve": payload.auto_approve.model_dump()}
    db.commit()
    db.refresh(tenant)
    return {"tenant_id": tenant.id, **_tenant_configuration(tenant)}


@router.put("/organization")
def update_organization(
    payload: OrganizationUpdateRequest,
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _, tenant = admin_context
    if payload.organization_name is not None:
        tenant.organization_name = payload.organization_name.strip()
    if payload.status is not None:
        if payload.status not in VALID_TEAM_STATUSES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid organization status.")
        tenant.status = payload.status
    db.commit()
    return {
        "id": tenant.id,
        "organization_name": tenant.organization_name,
        "status": tenant.status,
        "created_at": tenant.created_at.isoformat(),
    }


@router.get("/teams")
def list_teams(
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    _, tenant = admin_context
    teams = db.execute(select(Team).where(Team.tenant_id == tenant.id).order_by(Team.name)).scalars().all()
    return [_serialize_team(team) for team in teams]


@router.post("/teams")
def create_team(
    payload: TeamCreateRequest,
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _, tenant = admin_context
    if payload.status not in VALID_TEAM_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid team status.")

    team = Team(
        tenant_id=tenant.id,
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
        status=payload.status,
    )
    db.add(team)
    db.commit()
    db.refresh(team)
    return _serialize_team(team)


@router.get("/teams/{team_id}")
def get_team(
    team_id: str,
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _, tenant = admin_context
    team = _require_own_team(db, tenant, team_id)
    return _serialize_team(team)


@router.put("/teams/{team_id}")
def update_team(
    team_id: str,
    payload: TeamUpdateRequest,
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _, tenant = admin_context
    team = _require_own_team(db, tenant, team_id)
    if payload.name is not None:
        team.name = payload.name.strip()
    if payload.description is not None:
        team.description = payload.description.strip() or None
    if payload.status is not None:
        if payload.status not in VALID_TEAM_STATUSES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid team status.")
        team.status = payload.status
    db.commit()
    return _serialize_team(team)


@router.get("/teams/{team_id}/members")
def get_team_members(
    team_id: str,
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    _, tenant = admin_context
    team = _require_own_team(db, tenant, team_id)
    return _serialize_team(team)["members"]


@router.get("/workflow")
def get_workflow(
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _, tenant = admin_context
    workflow = _ensure_tenant_workflow(db, tenant.id)
    return _serialize_workflow(workflow)


@router.post("/workflow")
def create_or_update_workflow(
    payload: WorkflowRequest,
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    current_user, tenant = admin_context
    workflow = _ensure_tenant_workflow(db, tenant.id)
    if payload.name is not None:
        workflow.name = payload.name.strip()
    if payload.status:
        workflow.status = payload.status

    if payload.stages is not None:
        workflow.stages.clear()
        for stage in _prepare_stages_for_workflow(db, tenant, payload.stages):
            stage.workflow_id = workflow.id
            workflow.stages.append(stage)
        for order_index, stage in enumerate(sorted(workflow.stages, key=lambda item: item.stage_order), start=1):
            stage.stage_order = order_index
        _validate_workflow(db, workflow, tenant)

    db.commit()
    _record_workflow_audit(db, tenant, current_user, "workflow_updated", workflow, {"changes": "workflow_configured"})
    db.commit()
    return _serialize_workflow(workflow)


@router.put("/workflow")
def update_workflow(
    payload: WorkflowRequest,
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return create_or_update_workflow(payload=payload, admin_context=admin_context, db=db)


@router.post("/workflow/stages")
def add_workflow_stage(
    payload: WorkflowStageRequest,
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    current_user, tenant = admin_context
    workflow = _ensure_tenant_workflow(db, tenant.id)

    if payload.stage_type.strip().upper() not in VALID_STAGE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid stage type: {payload.stage_type}")

    inserted_stage = WorkflowStage(
        workflow_id=workflow.id,
        stage_type=payload.stage_type.strip().upper(),
        team_id=payload.team_id.strip() if payload.team_id else None,
        status=payload.status,
        stage_order=payload.stage_order if payload.stage_order is not None else len(workflow.stages) + 1,
    )
    if inserted_stage.team_id is not None:
        team = db.get(Team, inserted_stage.team_id)
        if team is None or team.tenant_id != tenant.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found in this tenant.")
        if team.status != "active":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Team {team.name} is inactive and cannot be assigned.")
    if inserted_stage.status not in VALID_TEAM_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid stage status.")

    workflow.stages.append(inserted_stage)
    for order_index, stage in enumerate(sorted(workflow.stages, key=lambda item: item.stage_order), start=1):
        stage.stage_order = order_index
    _validate_workflow(workflow, tenant)

    db.commit()
    _record_workflow_audit(db, tenant, current_user, "workflow_stage_added", workflow, {"stage_type": inserted_stage.stage_type})
    db.commit()
    return _serialize_workflow_stage(inserted_stage)


@router.put("/workflow/stages/{stage_id}")
def update_workflow_stage(
    stage_id: str,
    payload: WorkflowStageRequest,
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    current_user, tenant = admin_context
    workflow = _ensure_tenant_workflow(db, tenant.id)
    stage = db.get(WorkflowStage, stage_id)
    if stage is None or stage.workflow_id != workflow.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow stage not found.")

    if payload.stage_type is not None:
        stage.stage_type = payload.stage_type.strip().upper()
    if payload.team_id is not None:
        team_id = payload.team_id.strip() or None
        if team_id:
            team = db.get(Team, team_id)
            if team is None or team.tenant_id != tenant.id:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found in this tenant.")
            if team.status != "active":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Team {team.name} is inactive and cannot be assigned.")
        stage.team_id = team_id
    if payload.status is not None:
        if payload.status not in VALID_TEAM_STATUSES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid stage status.")
        stage.status = payload.status
    if payload.stage_order is not None:
        stage.stage_order = int(payload.stage_order)

    for order_index, item in enumerate(sorted(workflow.stages, key=lambda current: current.stage_order), start=1):
        item.stage_order = order_index
    _validate_workflow(workflow, tenant)

    db.commit()
    _record_workflow_audit(db, tenant, current_user, "workflow_stage_updated", workflow, {"stage_id": stage.id, "stage_type": stage.stage_type})
    db.commit()
    return _serialize_workflow_stage(stage)


@router.delete("/workflow/stages/{stage_id}")
def delete_workflow_stage(
    stage_id: str,
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    current_user, tenant = admin_context
    workflow = _ensure_tenant_workflow(db, tenant.id)
    stage = db.get(WorkflowStage, stage_id)
    if stage is None or stage.workflow_id != workflow.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow stage not found.")

    workflow.stages.remove(stage)
    for order_index, item in enumerate(sorted(workflow.stages, key=lambda current: current.stage_order), start=1):
        item.stage_order = order_index
    _validate_workflow(workflow, tenant)

    db.delete(stage)
    db.commit()
    _record_workflow_audit(db, tenant, current_user, "workflow_stage_removed", workflow, {"stage_id": stage_id})
    db.commit()
    return {"message": "Workflow stage removed."}


@router.get("/users")
def list_users(
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    _, tenant = admin_context
    users = db.execute(select(User).where(User.tenant_id == tenant.id).order_by(User.name)).scalars().all()
    return [_serialize_user(user, db) for user in users]


@router.get("/audit")
def list_audit_logs(
    limit: int = Query(default=100, ge=1, le=500),
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    current_user, _ = admin_context
    logs = db.execute(
        select(AuditLog)
        .where(AuditLog.tenant_id == current_user.tenant_id)
        .order_by(AuditLog.timestamp.desc())
        .limit(limit)
    ).scalars().all()
    return [
        {
            "id": log.id,
            "tenant_id": log.tenant_id,
            "actor_user_id": log.actor_user_id,
            "actor_name": log.actor_user.name if log.actor_user else None,
            "actor_email": log.actor_user.email if log.actor_user else None,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "timestamp": log.timestamp.isoformat(),
            "metadata": log.metadata_data or {},
        }
        for log in logs
    ]


@router.get("/users/{user_id}")
def get_user(
    user_id: str,
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _, tenant = admin_context
    user = _require_own_user(db, tenant, user_id)
    return _serialize_user(user, db)


@router.post("/users")
def create_user(
    payload: UserCreateRequest,
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _, tenant = admin_context
    if payload.status not in VALID_TEAM_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user status.")

    email = normalize_email(str(payload.email))
    existing = db.execute(select(User).where(User.tenant_id == tenant.id, User.email == email)).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A user with that email already exists in this tenant.")

    validate_password(payload.password)

    selected_roles: list[str] = []
    for item in payload.responsibilities:
        canonical = _canonicalize_responsibility(item)
        if canonical is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid responsibility: {item}")
        selected_roles.append(canonical)

    if not selected_roles:
        selected_roles = ["Operations Reviewer"]

    primary_role_name = selected_roles[0]
    primary_role = _ensure_role_for_tenant(db, tenant.id, primary_role_name)
    user = User(
        tenant_id=tenant.id,
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        status=payload.status,
        primary_role_id=primary_role.id,
    )
    db.add(user)
    db.flush()

    for team_id in payload.team_ids:
        team = _require_own_team(db, tenant, team_id)
        if team.status != "active":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Team {team.name} is inactive.")
        if db.execute(
            select(TeamMember).where(TeamMember.user_id == user.id, TeamMember.team_id == team.id)
        ).scalar_one_or_none() is None:
            db.add(TeamMember(user_id=user.id, team_id=team.id, role_id=primary_role.id))

    if payload.tenant_id and payload.tenant_id != tenant.id:
        payload.tenant_id = tenant.id

    db.commit()
    db.refresh(user)
    return _serialize_user(user, db)


@router.patch("/users/{user_id}/status")
def update_user_status(
    user_id: str,
    payload: UserStatusRequest,
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _, tenant = admin_context
    user = _require_own_user(db, tenant, user_id)
    if payload.status not in VALID_TEAM_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user status.")
    user.status = payload.status
    db.commit()
    return _serialize_user(user, db)


@router.post("/users/{user_id}/teams")
def assign_team_to_user(
    user_id: str,
    payload: TeamAssignmentRequest,
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _, tenant = admin_context
    user = _require_own_user(db, tenant, user_id)
    team = _require_own_team(db, tenant, payload.team_id)
    if team.status != "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Team is inactive and cannot accept new assignments.")

    role_name = payload.role if payload.role else (db.get(Role, user.primary_role_id).name if db.get(Role, user.primary_role_id) else "Operations Reviewer")
    assignment_role = _ensure_role_for_tenant(db, tenant.id, _canonicalize_responsibility(role_name) or role_name)

    membership = db.execute(
        select(TeamMember).where(TeamMember.user_id == user.id, TeamMember.team_id == team.id)
    ).scalar_one_or_none()
    if membership is None:
        membership = TeamMember(user_id=user.id, team_id=team.id, role_id=assignment_role.id)
        db.add(membership)
    else:
        membership.role_id = assignment_role.id

    db.commit()
    return _serialize_team(team)


@router.delete("/users/{user_id}/teams/{team_id}")
def remove_team_from_user(
    user_id: str,
    team_id: str,
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    _, tenant = admin_context
    user = _require_own_user(db, tenant, user_id)
    team = _require_own_team(db, tenant, team_id)
    membership = db.execute(
        select(TeamMember).where(TeamMember.user_id == user.id, TeamMember.team_id == team.id)
    ).scalar_one_or_none()
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found.")
    db.delete(membership)
    db.commit()
    return {"message": "Team assignment removed."}


@router.post("/users/{user_id}/responsibilities")
def assign_responsibility(
    user_id: str,
    payload: ResponsibilityRequest,
    admin_context: tuple[User, Tenant] = Depends(_require_tenant_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _, tenant = admin_context
    user = _require_own_user(db, tenant, user_id)
    role_name = _canonicalize_responsibility(payload.responsibility)
    if role_name is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid responsibility assignment.")

    role = _ensure_role_for_tenant(db, tenant.id, role_name)
    existing_roles = {r.name for r in db.execute(select(Role).where(Role.tenant_id == tenant.id)).scalars().all()}
    warnings = _responsibility_warnings({
        (db.get(Role, user.primary_role_id).name if db.get(Role, user.primary_role_id) else "Operations Reviewer")
    }, role_name)

    if user.primary_role_id is None or db.get(Role, user.primary_role_id) is None:
        user.primary_role_id = role.id
    else:
        user.primary_role_id = role.id

    db.commit()
    return {
        "id": user.id,
        "tenant_id": user.tenant_id,
        "primary_role": role_name,
        "warnings": warnings,
        "valid_roles": sorted(existing_roles),
    }
