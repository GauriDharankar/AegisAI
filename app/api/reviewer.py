from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.applications import _advance_application_to_next_stage, _record_audit_event, _require_tenant_application, _serialize_application
from app.db.database import get_db
from app.db.models import Application, AuditLog, Decision, Review, Role, User
from app.services.auth_service import get_current_user
from app.services.blockchain_service import submit_blockchain_audit

router = APIRouter(prefix="/api/v1", tags=["Reviewer"])

REVIEWER_ROLE_BY_STAGE = {
    "OPERATIONS_REVIEW": "Operations Reviewer",
    "RISK_REVIEW": "Risk Reviewer",
    "CREDIT_COMMITTEE_REVIEW": "Credit Committee Reviewer",
    "FINAL_DECISION": "Final Decision Maker",
}


class ReviewSubmitRequest(BaseModel):
    status: str = Field(default="approved", min_length=1, max_length=40)
    comments: str | None = Field(default=None, max_length=2000)


class FinalDecisionRequest(BaseModel):
    decision: str = Field(..., min_length=1, max_length=40)
    comments: str | None = Field(default=None, max_length=2000)


def _get_reviewer_roles_by_team(db: Session, current_user: User) -> dict[str, set[str]]:
    roles_by_team: dict[str, set[str]] = {}
    primary_role = db.get(Role, current_user.primary_role_id) if current_user.primary_role_id else None
    for membership in current_user.team_memberships:
        role = db.get(Role, membership.role_id) if membership.role_id else primary_role
        if role is not None:
            roles_by_team.setdefault(membership.team_id, set()).add(role.name)
    return roles_by_team


def _get_reviewer_role_names(db: Session, current_user: User) -> set[str]:
    return {
        role_name
        for role_names in _get_reviewer_roles_by_team(db, current_user).values()
        for role_name in role_names
    }


def _get_authorized_review_stage_types(db: Session, current_user: User) -> set[str]:
    role_names = _get_reviewer_role_names(db, current_user)
    return {stage_type for stage_type, role_name in REVIEWER_ROLE_BY_STAGE.items() if role_name in role_names}


def _require_reviewer_access(db: Session, current_user: User, application: Application) -> None:
    if application.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to applications in this tenant.")
    if application.assigned_team_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This application is not assigned to a team for review.")

    roles_by_team = _get_reviewer_roles_by_team(db, current_user)
    assigned_team_roles = roles_by_team.get(application.assigned_team_id, set())
    if not assigned_team_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not assigned to the application review team.")

    required_role_name = REVIEWER_ROLE_BY_STAGE.get(application.current_workflow_stage)
    if required_role_name is None or required_role_name not in assigned_team_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to review this application stage.")


def _require_final_decision_access(db: Session, current_user: User, application: Application) -> None:
    if application.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to applications in this tenant.")
    if application.current_workflow_stage != "FINAL_DECISION":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This application is not awaiting a final decision.")
    if application.assigned_team_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This application is not assigned to a final decision team.")

    roles_by_team = _get_reviewer_roles_by_team(db, current_user)
    assigned_team_roles = roles_by_team.get(application.assigned_team_id, set())
    if not assigned_team_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not assigned to the final decision team.")

    if "Final Decision Maker" not in assigned_team_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to submit the final decision.")


def _serialize_review_record(review: Review, application: Application) -> dict[str, Any]:
    return {
        "id": review.id,
        "application_id": review.application_id,
        "workflow_stage": application.current_workflow_stage,
        "workflow_stage_id": review.workflow_stage_id,
        "reviewer_id": review.reviewer_id,
        "status": review.status,
        "comments": review.comments,
        "created_at": review.created_at.isoformat(),
    }


@router.get("/reviewer/applications")
def list_reviewer_applications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    roles_by_team = _get_reviewer_roles_by_team(db, current_user)
    if not roles_by_team:
        return []

    reviewer_team_ids = list(roles_by_team)
    if not reviewer_team_ids:
        return []

    applications = db.execute(
        select(Application)
        .where(
            Application.tenant_id == current_user.tenant_id,
            Application.status != "completed",
            Application.assigned_team_id.in_(reviewer_team_ids),
        )
        .order_by(Application.created_at.desc())
    ).scalars().all()
    return [
        _serialize_application(application)
        for application in applications
        if REVIEWER_ROLE_BY_STAGE.get(application.current_workflow_stage) in roles_by_team.get(application.assigned_team_id, set())
    ]


@router.get("/reviewer/applications/{application_id}")
def get_reviewer_application(
    application_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    application = db.get(Application, application_id)
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    if application.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to applications in this tenant.")
    _require_reviewer_access(db, current_user, application)
    return _serialize_application(application)


@router.post("/reviewer/applications/{application_id}/reviews")
def submit_reviewer_review(
    application_id: str,
    payload: ReviewSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    application = db.get(Application, application_id)
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    if application.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to applications in this tenant.")
    _require_reviewer_access(db, current_user, application)

    if application.current_workflow_stage_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This application is not assigned to a valid workflow stage.")

    duplicate = db.execute(
        select(Review).where(
            Review.application_id == application.id,
            Review.workflow_stage_id == application.current_workflow_stage_id,
        )
    ).scalar_one_or_none()
    if duplicate is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A review for this application stage has already been submitted.")

    if application.current_workflow_stage == "FINAL_DECISION":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Final decision stages are not handled by reviewer progression.")

    review_status = payload.status.strip().lower()
    if review_status not in {"approved", "rejected", "pending"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Review status must be one of: approved, rejected, pending.")

    current_stage = application.current_workflow_stage
    review = Review(
        tenant_id=current_user.tenant_id,
        application_id=application.id,
        workflow_stage_id=application.current_workflow_stage_id,
        reviewer_id=current_user.id,
        status=review_status,
        comments=payload.comments.strip() if payload.comments else None,
    )
    db.add(review)
    db.flush()
    _record_audit_event(
        db,
        tenant_id=current_user.tenant_id,
        actor_user_id=current_user.id,
        action="review_submission",
        resource_type="application",
        resource_id=application.id,
        metadata={
            "application_id": application.id,
            "review_id": review.id,
            "workflow_stage": current_stage,
            "workflow_stage_id": application.current_workflow_stage_id,
            "review_status": review_status,
            "comments": review.comments,
        },
    )

    next_application = _advance_application_to_next_stage(db, application, current_user.tenant_id)
    return {
        "id": review.id,
        "application_id": application.id,
        "workflow_stage": current_stage,
        "status": review.status,
        "comments": review.comments,
        "created_at": review.created_at.isoformat(),
        "next_stage": next_application.current_workflow_stage,
        "next_team_id": next_application.assigned_team_id,
    }


@router.post("/reviewer/applications/{application_id}/final-decision")
def submit_final_decision(
    application_id: str,
    payload: FinalDecisionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    application = db.get(Application, application_id)
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    if application.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to applications in this tenant.")
    _require_final_decision_access(db, current_user, application)

    if application.status == "completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A final decision has already been submitted for this application.")

    existing_decision = db.execute(select(Decision).where(Decision.application_id == application.id)).scalar_one_or_none()
    if existing_decision is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A final decision has already been submitted for this application.")

    decision_value = payload.decision.strip().lower()
    if decision_value not in {"approved", "rejected"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Final decision must be either approved or rejected.")

    decision = Decision(
        tenant_id=current_user.tenant_id,
        application_id=application.id,
        decision=decision_value,
        decision_maker_id=current_user.id,
        ai_recommendation=None,
        override_reason=payload.comments.strip() if payload.comments else None,
    )
    db.add(decision)
    db.flush()

    application.status = "completed"
    application.updated_at = application.updated_at
    db.flush()
    _record_audit_event(
        db,
        tenant_id=current_user.tenant_id,
        actor_user_id=current_user.id,
        action="final_decision_submitted",
        resource_type="application",
        resource_id=application.id,
        metadata={
            "application_id": application.id,
            "decision_id": decision.id,
            "final_decision": decision_value,
            "workflow_stage": application.current_workflow_stage,
            "assigned_team_id": application.assigned_team_id,
            "comments": decision.override_reason,
        },
    )
    db.commit()
    db.refresh(application)

    governance_result = application.governance_result if isinstance(application.governance_result, dict) else {}
    governance_decision = governance_result.get("decision")
    decision_blockchain_payload = {
        "application_id": application.id,
        "tenant_id": current_user.tenant_id,
        "decision_id": decision.id,
        "governance_id": governance_result.get("governance_id"),
        "final_decision": decision_value,
        "decision_maker_id": current_user.id,
        "workflow_stage": application.current_workflow_stage,
        "governance_status": application.governance_status,
        "governance_route": governance_decision.get("final_decision") if isinstance(governance_decision, dict) else None,
    }
    blockchain_result = submit_blockchain_audit(decision_blockchain_payload)
    blockchain_metadata = {
        "application_id": application.id,
        "decision_id": decision.id,
        "blockchain_status": blockchain_result.get("status", "FAILED"),
        "audit_hash": blockchain_result.get("audit_hash"),
        "transaction_hash": blockchain_result.get("transaction_hash"),
        "audit_index": blockchain_result.get("audit_index"),
    }
    if blockchain_result.get("success"):
        blockchain_action = "blockchain_audit_recorded"
    else:
        blockchain_action = "blockchain_audit_failed"
        blockchain_metadata["message"] = blockchain_result.get(
            "message",
            "Blockchain audit service unavailable",
        )
    _record_audit_event(
        db,
        tenant_id=current_user.tenant_id,
        actor_user_id=current_user.id,
        action=blockchain_action,
        resource_type="application",
        resource_id=application.id,
        metadata=blockchain_metadata,
    )
    db.commit()

    return {
        "id": decision.id,
        "application_id": application.id,
        "decision": decision_value,
        "comments": decision.override_reason,
        "decision_maker_id": current_user.id,
        "workflow_stage": application.current_workflow_stage,
        "status": application.status,
        "created_at": decision.created_at.isoformat(),
        "blockchain": blockchain_result,
    }


@router.get("/governance/reviews/pending")
def get_pending_reviews(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    return list_reviewer_applications(current_user=current_user, db=db)


@router.get("/governance/reviews/{application_id}")
def get_review_application(
    application_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_reviewer_application(application_id=application_id, current_user=current_user, db=db)
