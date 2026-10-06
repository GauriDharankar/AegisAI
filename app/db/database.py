from __future__ import annotations

import os
from pathlib import Path
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool


MIGRATION_COLUMNS = [
    ("workflow_id", "TEXT", None),
    ("applicant_email", "TEXT", None),
    ("current_workflow_stage", "TEXT", "OPERATIONS_REVIEW"),
    ("current_workflow_stage_id", "TEXT", None),
    ("assigned_team_id", "TEXT", None),
    ("updated_at", "DATETIME", None),
    ("loan_type", "TEXT", None),
    ("loan_amount", "REAL", None),
    ("loan_tenure_months", "INTEGER", None),
    ("loan_purpose", "TEXT", None),
    ("monthly_income", "REAL", None),
    ("employment_type", "TEXT", None),
    ("employment_years", "REAL", None),
    ("credit_score", "INTEGER", None),
    ("existing_monthly_emi", "REAL", None),
    ("debt_to_income", "REAL", None),
    ("governance_status", "TEXT", None),
    ("governance_result", "JSON", None),
]

TENANT_MIGRATION_COLUMNS = [
    ("governance_configuration", "JSON", "{}"),
]

BASE_DIR = Path(__file__).resolve().parents[2]
raw_db_path = os.getenv("AEGISAI_DB_PATH", str(BASE_DIR / "aegisai.db"))
if raw_db_path and raw_db_path.strip().lower() == ":memory:":
    DATABASE_URL = "sqlite://"
    ENGINE_POOL_KWARGS = {"poolclass": StaticPool}
else:
    DB_PATH = Path(raw_db_path).resolve()
    DATABASE_URL = f"sqlite:///{DB_PATH}"
    ENGINE_POOL_KWARGS = {}


class Base(DeclarativeBase):
    pass


engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    **ENGINE_POOL_KWARGS,
    future=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


def get_db() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def migrate_sqlite_application_schema(target_engine=None) -> None:
    bind = target_engine or engine
    with bind.begin() as connection:
        tables = connection.exec_driver_sql("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        if not any(row[0] == "applications" for row in tables):
            return

        existing_columns = {
            row[1]
            for row in connection.exec_driver_sql("PRAGMA table_info(applications)").fetchall()
        }

        for column_name, column_type, default_value in MIGRATION_COLUMNS:
            if column_name in existing_columns:
                continue
            default_sql = ""
            if default_value is not None:
                default_sql = f" DEFAULT '{default_value}'"
            connection.exec_driver_sql(
                f"ALTER TABLE applications ADD COLUMN {column_name} {column_type}{default_sql}"
            )

        if "governance_workflows" not in {row[0] for row in tables}:
            return

        rows = connection.exec_driver_sql(
            "SELECT id, tenant_id, workflow_id, current_workflow_stage, current_workflow_stage_id, assigned_team_id FROM applications"
        ).fetchall()
        for app_id, tenant_id, workflow_id, current_stage, current_stage_id, assigned_team_id in rows:
            if workflow_id in (None, ""):
                workflow_row = connection.exec_driver_sql(
                    "SELECT id FROM governance_workflows WHERE tenant_id = ? ORDER BY created_at LIMIT 1",
                    (tenant_id,),
                ).fetchone()
                if workflow_row is not None:
                    workflow_id = workflow_row[0]
                    connection.exec_driver_sql(
                        "UPDATE applications SET workflow_id = ? WHERE id = ?",
                        (workflow_id, app_id),
                    )

            workflow_row = connection.exec_driver_sql(
                "SELECT id FROM governance_workflows WHERE tenant_id = ? ORDER BY created_at LIMIT 1",
                (tenant_id,),
            ).fetchone()
            if workflow_row is None:
                continue

            resolved_workflow_id = workflow_id or workflow_row[0]
            stage_row = connection.exec_driver_sql(
                "SELECT id, stage_type, team_id FROM workflow_stages WHERE workflow_id = ? ORDER BY stage_order LIMIT 1",
                (resolved_workflow_id,),
            ).fetchone()
            if stage_row is None:
                continue

            stage_id, stage_type, stage_team_id = stage_row
            update_values = [
                ("workflow_id", workflow_id or resolved_workflow_id),
            ]
            if current_stage in (None, ""):
                update_values.append(("current_workflow_stage", stage_type))
            if current_stage_id in (None, ""):
                update_values.append(("current_workflow_stage_id", stage_id))
            if assigned_team_id in (None, ""):
                update_values.append(("assigned_team_id", stage_team_id))

            if not update_values:
                continue

            assignments = ", ".join(f"{column_name} = ?" for column_name, _ in update_values)
            values = [value for _, value in update_values] + [app_id]
            connection.exec_driver_sql(
                f"UPDATE applications SET {assignments} WHERE id = ?",
                 tuple(values),
            )


def migrate_sqlite_tenant_schema(target_engine=None) -> None:
    bind = target_engine or engine
    with bind.begin() as connection:
        tables = {
            row[0]
            for row in connection.exec_driver_sql("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        }
        if "tenants" not in tables:
            return

        existing_columns = {
            row[1]
            for row in connection.exec_driver_sql("PRAGMA table_info(tenants)").fetchall()
        }
        for column_name, column_type, default_value in TENANT_MIGRATION_COLUMNS:
            if column_name in existing_columns:
                continue
            connection.exec_driver_sql(
                f"ALTER TABLE tenants ADD COLUMN {column_name} {column_type} NOT NULL DEFAULT '{default_value}'"
            )


def init_db() -> None:
    from app.db.models import (  # noqa: F401
        Application,
        AuditLog,
        Decision,
        GovernanceWorkflow,
        HunterAlert,
        Permission,
        Policy,
        PolicyVersion,
        Review,
        Role,
        Team,
        TeamMember,
        Tenant,
        User,
        WorkflowStage,
    )

    existing_tables = {
        row[0]
        for row in engine.connect().exec_driver_sql("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    }
    required_tables = {table.name for table in Base.metadata.sorted_tables}
    missing_tables = required_tables - existing_tables

    if missing_tables:
        Base.metadata.create_all(bind=engine)

    migrate_sqlite_application_schema(engine)
    migrate_sqlite_tenant_schema(engine)
