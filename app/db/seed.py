from __future__ import annotations

import hashlib
import os
from typing import Iterable

from sqlalchemy import select

from app.db.database import SessionLocal
from app.db.models import (
    GovernanceWorkflow,
    Permission,
    Role,
    Team,
    TeamMember,
    Tenant,
    User,
    WorkflowStage,
)


DEVELOPMENT_SEED_PASSWORD = "ChangeMe123!"


def _hash_password(password: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        b"aegisai-dev-seed-salt",
        200_000,
    ).hex()


def _ensure_permission(session, tenant_id: str, code: str, description: str) -> Permission:
    permission = session.execute(
        select(Permission).where(Permission.tenant_id == tenant_id, Permission.code == code)
    ).scalar_one_or_none()
    if permission is None:
        permission = Permission(tenant_id=tenant_id, code=code, description=description)
        session.add(permission)
        session.flush()
    return permission


def _create_role(session, tenant_id: str, name: str, description: str, permissions: Iterable[Permission]) -> Role:
    role = session.execute(
        select(Role).where(Role.tenant_id == tenant_id, Role.name == name)
    ).scalar_one_or_none()
    if role is None:
        role = Role(tenant_id=tenant_id, name=name, description=description)
        session.add(role)
        session.flush()

    existing_permission_ids = {perm.id for perm in role.permissions}
    for permission in permissions:
        if permission.id not in existing_permission_ids:
            role.permissions.append(permission)
    return role


def _create_workflow(session, tenant_id: str, name: str) -> GovernanceWorkflow:
    workflow = session.execute(
        select(GovernanceWorkflow).where(GovernanceWorkflow.tenant_id == tenant_id, GovernanceWorkflow.name == name)
    ).scalar_one_or_none()
    if workflow is None:
        workflow = GovernanceWorkflow(tenant_id=tenant_id, name=name, status="active")
        session.add(workflow)
        session.flush()
    return workflow


def seed_demo_data() -> None:
    """
    Development-only seed data. The password is intentionally simple and documented
    in this file because this is not production data and is only used for local demos.
    """
    if os.getenv("AEGISAI_TEST_MODE") == "1":
        return

    session = SessionLocal()
    try:
        if session.query(Tenant).count() > 0:
            return

        tenant_a = Tenant(organization_name="Demo Finance A", status="active")
        tenant_b = Tenant(organization_name="Demo Finance B", status="active")
        session.add_all([tenant_a, tenant_b])
        session.flush()

        tenant_permissions = {
            tenant_a.id: [
                _ensure_permission(session, tenant_a.id, "view_application", "View applications in the tenant"),
                _ensure_permission(session, tenant_a.id, "review_application", "Review applications"),
                _ensure_permission(session, tenant_a.id, "escalate_application", "Escalate applications to a higher workflow stage"),
                _ensure_permission(session, tenant_a.id, "make_final_decision", "Approve or reject final decisions"),
                _ensure_permission(session, tenant_a.id, "manage_users", "Manage users in the tenant"),
                _ensure_permission(session, tenant_a.id, "manage_workflow", "Manage the governance workflow"),
                _ensure_permission(session, tenant_a.id, "view_audit_logs", "View audit logs"),
            ],
            tenant_b.id: [
                _ensure_permission(session, tenant_b.id, "view_application", "View applications in the tenant"),
                _ensure_permission(session, tenant_b.id, "review_application", "Review applications"),
                _ensure_permission(session, tenant_b.id, "escalate_application", "Escalate applications to a higher workflow stage"),
                _ensure_permission(session, tenant_b.id, "make_final_decision", "Approve or reject final decisions"),
                _ensure_permission(session, tenant_b.id, "manage_users", "Manage users in the tenant"),
                _ensure_permission(session, tenant_b.id, "manage_workflow", "Manage the governance workflow"),
                _ensure_permission(session, tenant_b.id, "view_audit_logs", "View audit logs"),
            ],
        }

        tenant_roles = {}
        for tenant in [tenant_a, tenant_b]:
            permissions = tenant_permissions[tenant.id]
            tenant_roles[tenant.id] = {
                "tenant_admin": _create_role(
                    session,
                    tenant.id,
                    "Tenant Admin",
                    "Administrative tenant owner",
                    permissions,
                ),
                "operations_reviewer": _create_role(
                    session,
                    tenant.id,
                    "Operations Reviewer",
                    "Initial application triage and operations review",
                    [p for p in permissions if p.code in {"view_application", "review_application", "escalate_application"}],
                ),
                "risk_reviewer": _create_role(
                    session,
                    tenant.id,
                    "Risk Reviewer",
                    "Risk and fairness evaluation reviewer",
                    [p for p in permissions if p.code in {"view_application", "review_application", "escalate_application"}],
                ),
                "credit_committee_reviewer": _create_role(
                    session,
                    tenant.id,
                    "Credit Committee Reviewer",
                    "Credit committee review and policy approval",
                    [p for p in permissions if p.code in {"view_application", "review_application", "escalate_application", "view_audit_logs"}],
                ),
                "final_decision_maker": _create_role(
                    session,
                    tenant.id,
                    "Final Decision Maker",
                    "Final approval or rejection authority",
                    [p for p in permissions if p.code in {"view_application", "review_application", "make_final_decision", "view_audit_logs"}],
                ),
            }

        tenant_teams = {}
        for tenant in [tenant_a, tenant_b]:
            tenant_teams[tenant.id] = {
                "operations": Team(tenant_id=tenant.id, name="Operations Team", description="Operations workflow team", status="active"),
                "risk": Team(tenant_id=tenant.id, name="Risk Team", description="Risk evaluation team", status="active"),
                "credit": Team(tenant_id=tenant.id, name="Credit Committee", description="Credit committee review", status="active"),
                "executive": Team(tenant_id=tenant.id, name="Executive Decision Team", description="Final decision authority", status="active"),
            }
            session.add_all(list(tenant_teams[tenant.id].values()))
            session.flush()

        tenant_users = {}
        for tenant in [tenant_a, tenant_b]:
            tenant_users[tenant.id] = [
                User(
                    tenant_id=tenant.id,
                    name="Tenant Admin",
                    email=f"admin@{tenant.organization_name.lower().replace(' ', '')}.local",
                    password_hash=_hash_password(DEVELOPMENT_SEED_PASSWORD),
                    status="active",
                    primary_role_id=tenant_roles[tenant.id]["tenant_admin"].id,
                ),
                User(
                    tenant_id=tenant.id,
                    name="Operations Reviewer",
                    email=f"operations@{tenant.organization_name.lower().replace(' ', '')}.local",
                    password_hash=_hash_password(DEVELOPMENT_SEED_PASSWORD),
                    status="active",
                    primary_role_id=tenant_roles[tenant.id]["operations_reviewer"].id,
                ),
                User(
                    tenant_id=tenant.id,
                    name="Risk Reviewer",
                    email=f"risk@{tenant.organization_name.lower().replace(' ', '')}.local",
                    password_hash=_hash_password(DEVELOPMENT_SEED_PASSWORD),
                    status="active",
                    primary_role_id=tenant_roles[tenant.id]["risk_reviewer"].id,
                ),
                User(
                    tenant_id=tenant.id,
                    name="Credit Committee Reviewer",
                    email=f"committee@{tenant.organization_name.lower().replace(' ', '')}.local",
                    password_hash=_hash_password(DEVELOPMENT_SEED_PASSWORD),
                    status="active",
                    primary_role_id=tenant_roles[tenant.id]["credit_committee_reviewer"].id,
                ),
                User(
                    tenant_id=tenant.id,
                    name="Final Decision Maker",
                    email=f"manager@{tenant.organization_name.lower().replace(' ', '')}.local",
                    password_hash=_hash_password(DEVELOPMENT_SEED_PASSWORD),
                    status="active",
                    primary_role_id=tenant_roles[tenant.id]["final_decision_maker"].id,
                ),
            ]
            session.add_all(tenant_users[tenant.id])
            session.flush()

            for idx, user in enumerate(tenant_users[tenant.id]):
                if idx == 0:
                    team_name = "executive"
                elif idx == 1:
                    team_name = "operations"
                elif idx == 2:
                    team_name = "risk"
                elif idx == 3:
                    team_name = "credit"
                else:
                    team_name = "executive"

                team = tenant_teams[tenant.id][team_name]
                session.add(
                    TeamMember(
                        user_id=user.id,
                        team_id=team.id,
                        role_id=user.primary_role_id,
                    )
                )

        for tenant in [tenant_a, tenant_b]:
            workflow = _create_workflow(session, tenant.id, "Default Governance Workflow")
            stage_sequence = [
                ("OPERATIONS_REVIEW", "Operations Review", "operations"),
                ("RISK_REVIEW", "Risk Review", "risk"),
                ("CREDIT_COMMITTEE_REVIEW", "Credit Committee Review", "credit"),
                ("FINAL_DECISION", "Final Decision", "executive"),
            ]
            for order, (stage_type, _, team_key) in enumerate(stage_sequence, start=1):
                session.add(
                    WorkflowStage(
                        workflow_id=workflow.id,
                        stage_type=stage_type,
                        stage_order=order,
                        team_id=tenant_teams[tenant.id][team_key].id,
                        status="active",
                    )
                )

        session.commit()
    finally:
        session.close()
