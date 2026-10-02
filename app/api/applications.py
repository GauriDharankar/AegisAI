from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Application, AuditLog, GovernanceWorkflow, Policy, PolicyVersion, Team, Tenant, User, WorkflowStage
from app.services.auth_service import get_current_user
from app.services.governance_service import governance_service
from app.services.model_service import loan_model

router = APIRouter(prefix="/api/v1", tags=["Applications"])


class ApplicationCreateRequest(BaseModel):
    reference_code: str = Field(..., min_length=1, max_length=120)
    applicant_name: str = Field(..., min_length=1, max_length=255)
    applicant_email: EmailStr | None = None
    status: str = Field(default="new", min_length=1, max_length=40)
    team_id: str | None = None
    current_workflow_stage_id: str | None = None
    loan_type: str = Field(default="personal", min_length=1, max_length=120)
    loan_amount: float = Field(default=300000, gt=0)
    loan_tenure_months: int = Field(default=60, gt=0)
    loan_purpose: str = Field(default="general", min_length=1, max_length=255)
    monthly_income: float = Field(default=75000, gt=0)
    employment_type: str = Field(default="salaried", min_length=1, max_length=120)
    employment_years: float = Field(default=5, ge=0)
    credit_score: int = Field(default=700, ge=300, le=850)
    existing_monthly_emi: float = Field(default=0, ge=0)


class ApplicationUpdateRequest(BaseModel):
    reference_code: str | None = Field(default=None, min_length=1, max_length=120)
    applicant_name: str | None = Field(default=None, min_length=1, max_length=255)
    applicant_email: EmailStr | None = None
    status: str | None = Field(default=None, min_length=1, max_length=40)
    team_id: str | None = None
    current_workflow_stage_id: str | None = None


def _tenant_policy_rules(db: Session, tenant_id: str) -> list[dict[str, Any]]:
    policies = db.execute(
        select(Policy).where(Policy.tenant_id == tenant_id, Policy.enabled.is_(True))
    ).scalars().all()
    rules: list[dict[str, Any]] = []
    for policy in policies:
        version = db.execute(
            select(PolicyVersion)
            .where(PolicyVersion.policy_id == policy.id)
            .order_by(PolicyVersion.version_number.desc())
        ).scalars().first()
        if version is None:
            continue
        rule = dict(version.rule_definition or {})
        rule.setdefault("policy_id", policy.code)
        rule.setdefault("name", policy.name)
        rules.append(rule)
    return rules


def _evaluate_application(db: Session, tenant_id: str, payload: ApplicationCreateRequest) -> dict[str, Any]:
    debt_to_income = payload.existing_monthly_emi * 12 / payload.monthly_income
    features = {
        "income": payload.monthly_income * 12,
        "credit_score": payload.credit_score,
        "loan_amount": payload.loan_amount,
        "debt_to_income": debt_to_income,
        "employment_years": payload.employment_years,
    }
    prediction = loan_model.predict(features)
    return governance_service.evaluate(
        tenant_id=tenant_id,
        features=features,
        prediction=prediction,
        fairness_data={"predictions": [], "protected_groups": [], "config": {"enabled": True}},
        policies=_tenant_policy_rules(db, tenant_id),
        configuration={
            "risk": {"enabled": True},
            "auto_approve": {"enabled": False},
        },
            loan_type=payload.loan_type,
    )


def _serialize_application(application: Application) -> dict[str, Any]:
    return {
        "id": application.id,
        "tenant_id": application.tenant_id,
        "workflow_id": application.workflow_id,
        "workflow_name": application.workflow.name if application.workflow else None,
        "reference_code": application.reference_code,
        "applicant_name": application.applicant_name,
        "applicant_email": application.applicant_email,
        "loan_type": application.loan_type,
        "loan_amount": application.loan_amount,
        "loan_tenure_months": application.loan_tenure_months,
        "loan_purpose": application.loan_purpose,
        "monthly_income": application.monthly_income,
        "employment_type": application.employment_type,
        "employment_years": application.employment_years,
        "credit_score": application.credit_score,
        "existing_monthly_emi": application.existing_monthly_emi,
        "debt_to_income": application.debt_to_income,
        "governance_status": application.governance_status,
        "governance_result": application.governance_result,
        "status": application.status,
        "current_workflow_stage": application.current_workflow_stage,
        "current_workflow_stage_id": application.current_workflow_stage_id,
        "assigned_team_id": application.assigned_team_id,
        "assigned_team_name": application.assigned_team.name if application.assigned_team else None,
        "created_at": application.created_at.isoformat(),
        "updated_at": application.updated_at.isoformat(),
    }


def _record_audit_event(
    db: Session,
    tenant_id: str,
    actor_user_id: str | None,
    action: str,
    resource_type: str,
    resource_id: str,
    metadata: dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditLog(
            tenant_id=tenant_id,
            actor_user_id=actor_user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            metadata_data={
                "tenant_id": tenant_id,
                **(metadata or {}),
            },
        )
    )


def _validate_team_for_tenant(db: Session, tenant_id: str, team_id: str | None) -> str | None:
    if team_id is None:
        return None
    team = db.get(Team, team_id)
    if team is None or team.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found in this tenant.")
    return team.id


def _validate_workflow_stage_for_tenant(db: Session, tenant_id: str, stage_id: str | None) -> str | None:
    if stage_id is None:
        return None
    stage = db.get(WorkflowStage, stage_id)
    if stage is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow stage not found.")
    if stage.workflow.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow stage not found in this tenant.")
    return stage.id


def _get_active_tenant_workflow(db: Session, tenant_id: str) -> tuple[GovernanceWorkflow, WorkflowStage]:
    workflow = db.execute(
        select(GovernanceWorkflow)
        .where(GovernanceWorkflow.tenant_id == tenant_id, GovernanceWorkflow.status == "active")
        .order_by(GovernanceWorkflow.created_at)
    ).scalar_one_or_none()
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active governance workflow is configured for this tenant.")

    ordered_stages = sorted(workflow.stages, key=lambda stage: stage.stage_order)
    first_stage = next((stage for stage in ordered_stages if stage.status == "active"), None)
    if first_stage is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active workflow stages are configured for this tenant.")

    if first_stage.team_id is not None:
        team = db.get(Team, first_stage.team_id)
        if team is None or team.tenant_id != tenant_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The first configured workflow stage references a team outside this tenant.")
        if team.status != "active":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Team {team.name} is inactive and cannot be assigned.")

    return workflow, first_stage


def _require_tenant_application(db: Session, tenant_id: str, application_id: str) -> Application:
    application = db.execute(
        select(Application).where(Application.tenant_id == tenant_id, Application.id == application_id)
    ).scalar_one_or_none()
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    return application


def _advance_application_to_next_stage(db: Session, application: Application, tenant_id: str) -> Application:
    workflow = db.get(GovernanceWorkflow, application.workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application workflow not found.")
    if workflow.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application workflow not found in this tenant.")

    ordered_stages = sorted(workflow.stages, key=lambda stage: stage.stage_order)
    active_stages = [stage for stage in ordered_stages if stage.status == "active"]
    if not active_stages:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This workflow does not have any active stages.")

    current_stage = None
    if application.current_workflow_stage_id:
        current_stage = db.get(WorkflowStage, application.current_workflow_stage_id)
    if current_stage is None:
        current_stage = next(
            (stage for stage in active_stages if stage.stage_type == application.current_workflow_stage),
            None,
        )
    if current_stage is None or current_stage.workflow_id != workflow.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Application is not assigned to a valid workflow stage.")
    if current_stage.stage_type == "FINAL_DECISION":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Application is already at the final decision stage and cannot advance further.")

    next_stage = next(
        (stage for stage in active_stages if stage.stage_order > current_stage.stage_order),
        None,
    )
    if next_stage is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No further active workflow stage is configured for this application.")

    if next_stage.team_id is not None:
        team = db.get(Team, next_stage.team_id)
        if team is None or team.tenant_id != tenant_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The next workflow stage references a team outside this tenant.")
        if team.status != "active":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Team {team.name} is inactive and cannot be assigned.")

    if application.status in (None, "", "new"):
        application.status = "in_review"

    previous_stage = application.current_workflow_stage
    previous_team_id = application.assigned_team_id
    application.current_workflow_stage = next_stage.stage_type
    application.current_workflow_stage_id = next_stage.id
    application.assigned_team_id = next_stage.team_id
    db.flush()
    _record_audit_event(
        db,
        tenant_id=tenant_id,
        actor_user_id=None,
        action="workflow_stage_progressed",
        resource_type="application",
        resource_id=application.id,
        metadata={
            "application_id": application.id,
            "previous_stage": previous_stage,
            "new_stage": next_stage.stage_type,
            "previous_team_id": previous_team_id,
            "new_team_id": next_stage.team_id,
            "workflow_id": workflow.id,
        },
    )
    db.commit()
    db.refresh(application)
    return application


@router.post("/applications", response_model=dict[str, Any])
def create_application(
    payload: ApplicationCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    tenant_id = current_user.tenant_id
    if not payload.reference_code.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reference code is required.")

    existing = db.execute(
        select(Application).where(Application.tenant_id == tenant_id, Application.reference_code == payload.reference_code.strip())
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Application reference already exists for this tenant.")

    workflow, first_stage = _get_active_tenant_workflow(db, tenant_id)
    governance_result = _evaluate_application(db, tenant_id, payload)
    route = governance_result["decision"]["final_decision"]
    governance_status = governance_result["governance_status"]
    assigned_team_id = first_stage.team_id if first_stage.team_id is not None else _validate_team_for_tenant(db, tenant_id, payload.team_id)
    if payload.team_id and payload.team_id != assigned_team_id and first_stage.team_id is not None:
        assigned_team_id = first_stage.team_id

    application = Application(
        tenant_id=tenant_id,
        workflow_id=workflow.id,
        reference_code=payload.reference_code.strip(),
        applicant_name=payload.applicant_name.strip(),
        applicant_email=str(payload.applicant_email).lower() if payload.applicant_email else None,
        status="completed" if route == "AUTO_APPROVE" else ("rejected" if route == "REJECT" else "in_review"),
        current_workflow_stage=first_stage.stage_type,
        current_workflow_stage_id=first_stage.id,
        assigned_team_id=assigned_team_id,
        loan_type=payload.loan_type.strip(),
        loan_amount=payload.loan_amount,
        loan_tenure_months=payload.loan_tenure_months,
        loan_purpose=payload.loan_purpose.strip(),
        monthly_income=payload.monthly_income,
        employment_type=payload.employment_type.strip(),
        employment_years=payload.employment_years,
        credit_score=payload.credit_score,
        existing_monthly_emi=payload.existing_monthly_emi,
        debt_to_income=payload.existing_monthly_emi * 12 / payload.monthly_income,
        governance_status=governance_status,
        governance_result=governance_result,
    )

    if route != "HUMAN_REVIEW":
        application.assigned_team_id = None

    db.add(application)
    db.flush()
    _record_audit_event(
        db,
        tenant_id=tenant_id,
        actor_user_id=current_user.id,
        action="application_created",
        resource_type="application",
        resource_id=application.id,
        metadata={
            "application_id": application.id,
            "reference_code": application.reference_code,
            "applicant_name": application.applicant_name,
            "current_workflow_stage": application.current_workflow_stage,
            "assigned_team_id": application.assigned_team_id,
            "workflow_id": workflow.id,
            "governance_id": governance_result["governance_id"],
            "governance_status": governance_status,
            "governance_route": route,
        },
    )
    db.commit()
    db.refresh(application)
    return _serialize_application(application)


@router.get("/applications")
def list_applications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    applications = db.execute(
        select(Application).where(Application.tenant_id == current_user.tenant_id).order_by(Application.created_at.desc())
    ).scalars().all()
    return [_serialize_application(application) for application in applications]


@router.get("/applications/{application_id}")
def get_application(
    application_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    application = _require_tenant_application(db, current_user.tenant_id, application_id)
    return _serialize_application(application)


@router.post("/applications/{application_id}/advance-stage")
def advance_application_stage(
    application_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    application = _require_tenant_application(db, current_user.tenant_id, application_id)
    application = _advance_application_to_next_stage(db, application, current_user.tenant_id)
    return _serialize_application(application)
