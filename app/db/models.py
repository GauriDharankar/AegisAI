from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
import uuid

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Float,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def generate_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12].upper()}"


role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
    Index("ix_role_permissions_role_id", "role_id"),
    Index("ix_role_permissions_permission_id", "permission_id"),
)


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: generate_id("TEN"))
    organization_name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )
    governance_configuration: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    users: Mapped[list["User"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    roles: Mapped[list["Role"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    permissions: Mapped[list["Permission"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    teams: Mapped[list["Team"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    workflows: Mapped[list["GovernanceWorkflow"]] = relationship(
        back_populates="tenant",
        cascade="all, delete-orphan",
    )
    applications: Mapped[list["Application"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    reviews: Mapped[list["Review"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    decisions: Mapped[list["Decision"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    hunter_alerts: Mapped[list["HunterAlert"]] = relationship(back_populates="recipient_tenant", cascade="all, delete-orphan")
    policies: Mapped[list["Policy"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("tenant_id", "email", name="uq_user_tenant_email"),
        Index("ix_users_tenant_id", "tenant_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: generate_id("USR"))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )
    primary_role_id: Mapped[Optional[str]] = mapped_column(ForeignKey("roles.id", ondelete="SET NULL"), nullable=True)

    tenant: Mapped["Tenant"] = relationship(back_populates="users")
    primary_role: Mapped[Optional["Role"]] = relationship(back_populates="users")
    team_memberships: Mapped[list["TeamMember"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    reviews: Mapped[list["Review"]] = relationship(back_populates="reviewer", cascade="all, delete-orphan")
    decisions: Mapped[list["Decision"]] = relationship(back_populates="decision_maker", cascade="all, delete-orphan")
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="actor_user", cascade="all, delete-orphan")


class Role(Base):
    __tablename__ = "roles"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_role_tenant_name"),
        Index("ix_roles_tenant_id", "tenant_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: generate_id("ROL"))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )

    tenant: Mapped["Tenant"] = relationship(back_populates="roles")
    users: Mapped[list["User"]] = relationship(back_populates="primary_role")
    permissions: Mapped[list["Permission"]] = relationship(
        secondary=role_permissions,
        back_populates="roles",
    )
    team_memberships: Mapped[list["TeamMember"]] = relationship(back_populates="role")


class Permission(Base):
    __tablename__ = "permissions"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_permission_tenant_code"),
        Index("ix_permissions_tenant_id", "tenant_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: generate_id("PER"))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    code: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    tenant: Mapped["Tenant"] = relationship(back_populates="permissions")
    roles: Mapped[list["Role"]] = relationship(
        secondary=role_permissions,
        back_populates="permissions",
    )


class Team(Base):
    __tablename__ = "teams"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_team_tenant_name"),
        Index("ix_teams_tenant_id", "tenant_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: generate_id("TEAM"))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )

    tenant: Mapped["Tenant"] = relationship(back_populates="teams")
    members: Mapped[list["TeamMember"]] = relationship(back_populates="team", cascade="all, delete-orphan")
    workflow_stages: Mapped[list["WorkflowStage"]] = relationship(back_populates="team", cascade="all, delete-orphan")
    applications: Mapped[list["Application"]] = relationship(back_populates="assigned_team")


class TeamMember(Base):
    __tablename__ = "team_members"
    __table_args__ = (
        Index("ix_team_members_user_id", "user_id"),
        Index("ix_team_members_team_id", "team_id"),
    )

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True)
    role_id: Mapped[Optional[str]] = mapped_column(ForeignKey("roles.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    user: Mapped["User"] = relationship(back_populates="team_memberships")
    team: Mapped["Team"] = relationship(back_populates="members")
    role: Mapped[Optional["Role"]] = relationship(back_populates="team_memberships")


class GovernanceWorkflow(Base):
    __tablename__ = "governance_workflows"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_workflow_tenant_name"),
        Index("ix_governance_workflows_tenant_id", "tenant_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: generate_id("GWF"))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )

    tenant: Mapped["Tenant"] = relationship(back_populates="workflows")
    stages: Mapped[list["WorkflowStage"]] = relationship(
        back_populates="workflow",
        cascade="all, delete-orphan",
    )
    applications: Mapped[list["Application"]] = relationship(back_populates="workflow", cascade="all, delete-orphan")


class WorkflowStage(Base):
    __tablename__ = "workflow_stages"
    __table_args__ = (
        Index("ix_workflow_stages_workflow_id", "workflow_id"),
        Index("ix_workflow_stages_team_id", "team_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: generate_id("WFS"))
    workflow_id: Mapped[str] = mapped_column(ForeignKey("governance_workflows.id", ondelete="CASCADE"), nullable=False)
    stage_type: Mapped[str] = mapped_column(String(80), nullable=False)
    stage_order: Mapped[int] = mapped_column(nullable=False)
    team_id: Mapped[Optional[str]] = mapped_column(ForeignKey("teams.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )

    workflow: Mapped["GovernanceWorkflow"] = relationship(back_populates="stages")
    team: Mapped[Optional["Team"]] = relationship(back_populates="workflow_stages")
    reviews: Mapped[list["Review"]] = relationship(back_populates="workflow_stage", cascade="all, delete-orphan")
    applications: Mapped[list["Application"]] = relationship(back_populates="current_workflow_stage_ref")


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        UniqueConstraint("tenant_id", "reference_code", name="uq_application_tenant_reference"),
        Index("ix_applications_tenant_id", "tenant_id"),
        Index("ix_applications_status", "status"),
        Index("ix_applications_assigned_team_id", "assigned_team_id"),
        Index("ix_applications_current_workflow_stage_id", "current_workflow_stage_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: generate_id("APP"))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    workflow_id: Mapped[str] = mapped_column(ForeignKey("governance_workflows.id", ondelete="CASCADE"), nullable=False)
    reference_code: Mapped[str] = mapped_column(String(120), nullable=False)
    applicant_name: Mapped[str] = mapped_column(String(255), nullable=False)
    applicant_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    loan_type: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    loan_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    loan_tenure_months: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    loan_purpose: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    monthly_income: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    employment_type: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    employment_years: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    credit_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    existing_monthly_emi: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    debt_to_income: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    governance_status: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    governance_result: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="new", nullable=False)
    current_workflow_stage: Mapped[str] = mapped_column(String(80), default="OPERATIONS_REVIEW", nullable=False)
    current_workflow_stage_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("workflow_stages.id", ondelete="SET NULL"),
        nullable=True,
    )
    assigned_team_id: Mapped[Optional[str]] = mapped_column(ForeignKey("teams.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )

    tenant: Mapped["Tenant"] = relationship(back_populates="applications")
    workflow: Mapped["GovernanceWorkflow"] = relationship(back_populates="applications")
    current_workflow_stage_ref: Mapped[Optional["WorkflowStage"]] = relationship(back_populates="applications")
    assigned_team: Mapped[Optional["Team"]] = relationship(back_populates="applications")
    reviews: Mapped[list["Review"]] = relationship(back_populates="application", cascade="all, delete-orphan")
    decisions: Mapped[list["Decision"]] = relationship(back_populates="application", cascade="all, delete-orphan")
    hunter_alerts: Mapped[list["HunterAlert"]] = relationship(back_populates="application", cascade="all, delete-orphan")


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        Index("ix_reviews_tenant_id", "tenant_id"),
        Index("ix_reviews_application_id", "application_id"),
        Index("ix_reviews_reviewer_id", "reviewer_id"),
        Index("ix_reviews_stage_id", "workflow_stage_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: generate_id("REV"))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), nullable=False)
    workflow_stage_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("workflow_stages.id", ondelete="CASCADE"),
        nullable=True,
    )
    reviewer_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="pending", nullable=False)
    comments: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )

    tenant: Mapped["Tenant"] = relationship(back_populates="reviews")
    application: Mapped["Application"] = relationship(back_populates="reviews")
    workflow_stage: Mapped[Optional["WorkflowStage"]] = relationship(back_populates="reviews")
    reviewer: Mapped["User"] = relationship(back_populates="reviews")


class Decision(Base):
    __tablename__ = "decisions"
    __table_args__ = (
        Index("ix_decisions_tenant_id", "tenant_id"),
        Index("ix_decisions_application_id", "application_id"),
        Index("ix_decisions_decision_maker_id", "decision_maker_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: generate_id("DEC"))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), nullable=False)
    decision: Mapped[str] = mapped_column(String(40), nullable=False)
    decision_maker_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    ai_recommendation: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    override_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    tenant: Mapped["Tenant"] = relationship(back_populates="decisions")
    application: Mapped["Application"] = relationship(back_populates="decisions")
    decision_maker: Mapped[Optional["User"]] = relationship(back_populates="decisions")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_tenant_id", "tenant_id"),
        Index("ix_audit_logs_actor_user_id", "actor_user_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: generate_id("AUD"))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    actor_user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(180), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(120), nullable=False)
    resource_id: Mapped[str] = mapped_column(String(120), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    metadata_data: Mapped[Optional[dict]] = mapped_column("metadata", JSON, nullable=True)

    tenant: Mapped["Tenant"] = relationship(back_populates="audit_logs")
    actor_user: Mapped[Optional["User"]] = relationship(back_populates="audit_logs")


class HunterAlert(Base):
    __tablename__ = "hunter_alerts"
    __table_args__ = (
        Index("ix_hunter_alerts_recipient_tenant_id", "recipient_tenant_id"),
        Index("ix_hunter_alerts_application_id", "application_id"),
        Index("ix_hunter_alerts_status", "status"),
        Index("ix_hunter_alerts_created_at", "created_at"),
    )

    alert_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: generate_id("HAL"))
    recipient_tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), nullable=False)
    alert_type: Mapped[str] = mapped_column(String(120), nullable=False)
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="OPEN", nullable=False)
    loan_type: Mapped[str] = mapped_column(String(120), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    recipient_tenant: Mapped["Tenant"] = relationship(back_populates="hunter_alerts")
    application: Mapped["Application"] = relationship(back_populates="hunter_alerts")


class Policy(Base):
    __tablename__ = "policies"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_policy_tenant_code"),
        Index("ix_policies_tenant_id", "tenant_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: generate_id("POL"))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )

    tenant: Mapped["Tenant"] = relationship(back_populates="policies")
    versions: Mapped[list["PolicyVersion"]] = relationship(back_populates="policy", cascade="all, delete-orphan")


class PolicyVersion(Base):
    __tablename__ = "policy_versions"
    __table_args__ = (
        UniqueConstraint("policy_id", "version_number", name="uq_policy_version"),
        Index("ix_policy_versions_policy_id", "policy_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: generate_id("POLV"))
    policy_id: Mapped[str] = mapped_column(ForeignKey("policies.id", ondelete="CASCADE"), nullable=False)
    version_number: Mapped[int] = mapped_column(nullable=False)
    rule_definition: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    policy: Mapped["Policy"] = relationship(back_populates="versions")
