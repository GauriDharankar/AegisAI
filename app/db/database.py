from __future__ import annotations

import os
from pathlib import Path
from typing import Iterator

from sqlalchemy import URL, create_engine, make_url
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
    ("verification_status", "TEXT", "PENDING"),
    ("registration_number", "VARCHAR(128)", None),
    ("verification_reviewed_at", "DATETIME", None),
    ("verification_reviewer_id", "TEXT REFERENCES users(id) ON DELETE SET NULL", None),
    ("verification_reason", "TEXT", None),
]

BASE_DIR = Path(__file__).resolve().parents[2]


def _configured_database_url() -> URL:
    configured_url = os.getenv("DATABASE_URL", "").strip()
    if configured_url:
        url = make_url(configured_url)
        if url.drivername in {"postgres", "postgresql"}:
            url = url.set(drivername="postgresql+psycopg")
        return url

    raw_db_path = os.getenv("AEGISAI_DB_PATH", str(BASE_DIR / "aegisai.db")).strip()
    if raw_db_path.lower() == ":memory:":
        return URL.create("sqlite", database="")
    return URL.create("sqlite", database=str(Path(raw_db_path).resolve()))


def create_database_engine(database_url: str | None = None):
    configured_url = make_url(database_url) if database_url else _configured_database_url()
    if configured_url.drivername in {"postgres", "postgresql"}:
        configured_url = configured_url.set(drivername="postgresql+psycopg")

    engine_options = {"future": True}
    if configured_url.get_backend_name() == "sqlite":
        engine_options["connect_args"] = {"check_same_thread": False}
        if configured_url.database in {"", ":memory:"}:
            engine_options["poolclass"] = StaticPool
    return create_engine(configured_url, **engine_options)


DATABASE_URL = _configured_database_url()
DB_PATH = (
    Path(DATABASE_URL.database).resolve()
    if DATABASE_URL.get_backend_name() == "sqlite"
    and DATABASE_URL.database not in {"", ":memory:"}
    else None
)


class Base(DeclarativeBase):
    pass


engine = create_database_engine(str(DATABASE_URL))

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


def _require_sqlite(target_engine) -> None:
    if target_engine.dialect.name != "sqlite":
        raise ValueError("SQLite migration functions only support SQLite databases.")


def migrate_sqlite_application_schema(target_engine=None) -> None:
    bind = target_engine or engine
    _require_sqlite(bind)
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
    _require_sqlite(bind)
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
            if default_value is None:
                column_definition = column_type
            else:
                column_definition = f"{column_type} NOT NULL DEFAULT '{default_value}'"
            connection.exec_driver_sql(
                f"ALTER TABLE tenants ADD COLUMN {column_name} {column_definition}"
            )


def migrate_sqlite_user_schema(target_engine=None) -> None:
    bind = target_engine or engine
    _require_sqlite(bind)
    with bind.begin() as connection:
        tables = {
            row[0]
            for row in connection.exec_driver_sql("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        }
        if "users" not in tables:
            return

        existing_columns = {
            row[1]
            for row in connection.exec_driver_sql("PRAGMA table_info(users)").fetchall()
        }
        if "is_platform_admin" not in existing_columns:
            connection.exec_driver_sql(
                "ALTER TABLE users ADD COLUMN is_platform_admin BOOLEAN NOT NULL DEFAULT 0"
            )
        additions = (
            ("phone_number_encrypted", "TEXT"),
            ("phone_number_hash", "VARCHAR(64)"),
            ("phone_verified_at", "DATETIME"),
            ("session_version", "INTEGER NOT NULL DEFAULT 0"),
        )
        for column_name, column_type in additions:
            if column_name not in existing_columns:
                connection.exec_driver_sql(
                    f"ALTER TABLE users ADD COLUMN {column_name} {column_type}"
                )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_users_phone_number_hash ON users (phone_number_hash)"
        )
        if "platform_admin_password_reset_challenges" in tables:
            reset_columns = {
                row[1]
                for row in connection.exec_driver_sql(
                    "PRAGMA table_info(platform_admin_password_reset_challenges)"
                ).fetchall()
            }
            if "phone_number_hash" not in reset_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE platform_admin_password_reset_challenges "
                    "ADD COLUMN phone_number_hash VARCHAR(64)"
                )


def migrate_sqlite_review_schema(target_engine=None) -> None:
    bind = target_engine or engine
    _require_sqlite(bind)
    with bind.begin() as connection:
        tables = {
            row[0]
            for row in connection.exec_driver_sql("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        }
        if "reviews" not in tables:
            return

        stage_column = next(
            row
            for row in connection.exec_driver_sql("PRAGMA table_info(reviews)").fetchall()
            if row[1] == "workflow_stage_id"
        )
        if not stage_column[3]:
            return

        connection.exec_driver_sql(
            """
            CREATE TABLE reviews_new (
                id VARCHAR(64) NOT NULL PRIMARY KEY,
                tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                application_id VARCHAR(64) NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
                workflow_stage_id VARCHAR(64) REFERENCES workflow_stages(id) ON DELETE CASCADE,
                reviewer_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE SET NULL,
                status VARCHAR(40) NOT NULL,
                comments TEXT,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            )
            """
        )
        connection.exec_driver_sql(
            """
            INSERT INTO reviews_new (
                id, tenant_id, application_id, workflow_stage_id, reviewer_id,
                status, comments, created_at, updated_at
            )
            SELECT
                id, tenant_id, application_id, workflow_stage_id, reviewer_id,
                status, comments, created_at, updated_at
            FROM reviews
            """
        )
        connection.exec_driver_sql("DROP TABLE reviews")
        connection.exec_driver_sql("ALTER TABLE reviews_new RENAME TO reviews")
        connection.exec_driver_sql("CREATE INDEX ix_reviews_tenant_id ON reviews (tenant_id)")
        connection.exec_driver_sql("CREATE INDEX ix_reviews_application_id ON reviews (application_id)")
        connection.exec_driver_sql("CREATE INDEX ix_reviews_reviewer_id ON reviews (reviewer_id)")
        connection.exec_driver_sql("CREATE INDEX ix_reviews_stage_id ON reviews (workflow_stage_id)")


def _load_models() -> None:
    from app.db.models import (  # noqa: F401
        Application,
        AuditLog,
        Decision,
        GovernanceWorkflow,
        HunterAlert,
        Permission,
        PlatformAdmin,
        PlatformAuditLog,
        PasswordResetChallenge,
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


def initialize_postgresql_schema(target_engine=None) -> None:
    """Create missing PostgreSQL tables; existing-schema changes require a reviewed migration."""
    bind = target_engine or engine
    if bind.dialect.name != "postgresql":
        raise ValueError("PostgreSQL schema initialization requires a PostgreSQL engine.")
    _load_models()
    Base.metadata.create_all(bind=bind)


def init_db() -> None:
    _load_models()
    if engine.dialect.name == "postgresql":
        initialize_postgresql_schema(engine)
        return
    if engine.dialect.name != "sqlite":
        raise ValueError(f"Unsupported database dialect: {engine.dialect.name}")

    Base.metadata.create_all(bind=engine)
    migrate_sqlite_application_schema(engine)
    migrate_sqlite_tenant_schema(engine)
    migrate_sqlite_user_schema(engine)
    migrate_sqlite_review_schema(engine)
