from __future__ import annotations

import sqlite3

from fastapi import HTTPException
import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.db.models import AuditLog, Base, PlatformAdmin, Role, Tenant, User, utcnow
from app.db.database import migrate_sqlite_user_schema
from app.provision_platform_admin import (
    ENVIRONMENT_VARIABLE,
    PHONE_ENROLLMENT_VALUE,
    PHONE_ENROLLMENT_VARIABLE,
    OPT_IN_VALUE,
    OPT_IN_VARIABLE,
    ProvisioningError,
    provision_first_platform_admin,
    resolve_phone_enrollment_database,
    resolve_target_database,
    run_interactive,
    run_phone_enrollment,
)
from app.services.auth_service import create_platform_admin_user, require_platform_admin


@pytest.fixture
def provisioning_database(tmp_path):
    path = tmp_path / "aegisai-dev.db"
    engine = create_engine(f"sqlite:///{path.as_posix()}", future=True)
    Base.metadata.create_all(bind=engine)
    engine.dispose()
    return path


def _environment(path, **overrides):
    values = {
        OPT_IN_VARIABLE: OPT_IN_VALUE,
        ENVIRONMENT_VARIABLE: "development",
        "AEGISAI_DB_PATH": str(path),
    }
    values.update(overrides)
    return values


def _count_records(path, table_name):
    with sqlite3.connect(path) as connection:
        return connection.execute(f"SELECT count(*) FROM {table_name}").fetchone()[0]


def test_provisioning_requires_development_opt_in_and_explicit_database(provisioning_database):
    with pytest.raises(ProvisioningError, match="opt in"):
        resolve_target_database(_environment(provisioning_database, **{OPT_IN_VARIABLE: ""}))

    with pytest.raises(ProvisioningError, match="development"):
        resolve_target_database(_environment(provisioning_database, **{ENVIRONMENT_VARIABLE: "production"}))

    with pytest.raises(ProvisioningError, match="absolute path"):
        resolve_target_database(_environment(provisioning_database, AEGISAI_DB_PATH="relative.db"))

    with pytest.raises(ProvisioningError, match="existing SQLite file"):
        resolve_target_database(
            _environment(provisioning_database, AEGISAI_DB_PATH=":memory:")
        )


def test_legacy_users_receive_phone_and_session_security_columns():
    engine = create_engine("sqlite://", future=True)
    try:
        with engine.begin() as connection:
            connection.exec_driver_sql(
                "CREATE TABLE users (id TEXT PRIMARY KEY, is_platform_admin BOOLEAN NOT NULL DEFAULT 0)"
            )
            connection.exec_driver_sql("INSERT INTO users (id) VALUES ('legacy-user')")
            connection.exec_driver_sql(
                "CREATE TABLE platform_admin_password_reset_challenges (id TEXT PRIMARY KEY)"
            )

        migrate_sqlite_user_schema(engine)

        with engine.connect() as connection:
            columns = {
                row[1]
                for row in connection.exec_driver_sql("PRAGMA table_info(users)").fetchall()
            }
            assert {
                "phone_number_encrypted",
                "phone_number_hash",
                "phone_verified_at",
                "session_version",
            }.issubset(columns)
            assert connection.exec_driver_sql(
                "SELECT session_version FROM users WHERE id = 'legacy-user'"
            ).scalar_one() == 0
            challenge_columns = {
                row[1]
                for row in connection.exec_driver_sql(
                    "PRAGMA table_info(platform_admin_password_reset_challenges)"
                ).fetchall()
            }
            assert "phone_number_hash" in challenge_columns
    finally:
        engine.dispose()


def test_interactive_path_confirmation_must_match_before_writes(provisioning_database):
    outputs = []

    with pytest.raises(ProvisioningError, match="confirmation did not match"):
        run_interactive(
            _environment(provisioning_database),
            input_fn=lambda _prompt: "wrong path",
            password_fn=lambda _prompt: pytest.fail("password prompt must not run"),
            output_fn=outputs.append,
        )

    assert outputs == [f"Target SQLite database: {provisioning_database.resolve()}"]
    assert _count_records(provisioning_database, "users") == 0
    assert _count_records(provisioning_database, "tenants") == 0


def test_phone_enrollment_confirmation_ignores_accidental_outer_whitespace(provisioning_database):
    engine = create_engine(f"sqlite:///{provisioning_database.as_posix()}", future=True)
    try:
        with Session(engine) as session:
            create_platform_admin_user(
                session,
                full_name="Existing Platform Admin",
                email="existing@example.test",
                password="SecurePass123",
                phone_number="+15555550100",
                phone_verified_at=utcnow(),
            )
            session.commit()
    finally:
        engine.dispose()

    answers = iter(
        [
            f"  {provisioning_database.resolve()}  ",
            "existing@example.test",
            "+15555550101",
        ]
    )
    outputs = []

    def input_fn(prompt: str) -> str:
        if prompt.startswith("Enter the verification code"):
            return next(line.split(": ", 1)[1] for line in outputs if line.startswith("Development-only test OTP:"))
        return next(answers)

    run_phone_enrollment(
        _environment(
            provisioning_database,
            **{PHONE_ENROLLMENT_VARIABLE: PHONE_ENROLLMENT_VALUE},
        ),
        input_fn=input_fn,
        output_fn=outputs.append,
    )
    assert outputs[-1] == "Verified phone enrollment completed. Existing sessions were revoked."


def test_interactive_provisioning_verifies_mobile_before_creating_account(provisioning_database):
    from app.services.phone_service import decrypt_phone_number

    outputs = []
    answers = iter(
        [
            str(provisioning_database.resolve()),
            "Authorized Platform Admin",
            "platform@example.test",
            "+15555550100",
        ]
    )

    def input_fn(prompt: str) -> str:
        if prompt.startswith("Enter the verification code"):
            test_code = next(line.split(": ", 1)[1] for line in outputs if line.startswith("Development-only test OTP:"))
            return test_code
        return next(answers)

    password_answers = iter(["SecurePass123", "SecurePass123"])
    run_interactive(
        _environment(provisioning_database),
        input_fn=input_fn,
        password_fn=lambda _prompt: next(password_answers),
        output_fn=outputs.append,
    )

    engine = create_engine(f"sqlite:///{provisioning_database.as_posix()}", future=True)
    try:
        with Session(engine) as session:
            user = session.scalar(select(User).where(User.email == "platform@example.test"))
            assert user is not None
            assert user.phone_verified_at is not None
            assert decrypt_phone_number(user.phone_number_encrypted) == "+15555550100"
    finally:
        engine.dispose()


def test_phone_enrollment_requires_local_opt_in_and_verifies_new_number(provisioning_database):
    from app.services.phone_service import decrypt_phone_number

    engine = create_engine(f"sqlite:///{provisioning_database.as_posix()}", future=True)
    try:
        with Session(engine) as session:
            create_platform_admin_user(
                session,
                full_name="Existing Platform Admin",
                email="existing@example.test",
                password="SecurePass123",
                phone_number="+15555550100",
                phone_verified_at=utcnow(),
            )
            session.commit()
    finally:
        engine.dispose()

    outputs = []
    answers = iter(
        [
            str(provisioning_database.resolve()),
            "existing@example.test",
            "+15555550101",
        ]
    )

    def input_fn(prompt: str) -> str:
        if prompt.startswith("Enter the verification code"):
            return next(line.split(": ", 1)[1] for line in outputs if line.startswith("Development-only test OTP:"))
        return next(answers)

    environment = _environment(
        provisioning_database,
        **{PHONE_ENROLLMENT_VARIABLE: PHONE_ENROLLMENT_VALUE},
    )
    run_phone_enrollment(environment, input_fn=input_fn, output_fn=outputs.append)

    engine = create_engine(f"sqlite:///{provisioning_database.as_posix()}", future=True)
    try:
        with Session(engine) as session:
            user = session.scalar(select(User).where(User.email == "existing@example.test"))
            assert user is not None
            assert decrypt_phone_number(user.phone_number_encrypted) == "+15555550101"
            assert user.session_version == 1
    finally:
        engine.dispose()

    with pytest.raises(ProvisioningError, match="opt in"):
        resolve_phone_enrollment_database(_environment(provisioning_database))


def test_invalid_phone_encryption_key_fails_before_contacting_sms_provider(monkeypatch):
    from app.provision_platform_admin import _verify_contact_number
    from app.services.phone_service import PhoneConfigurationError

    monkeypatch.setenv("AEGISAI_PHONE_ENCRYPTION_KEY", "not-a-valid-fernet-key")

    class ProviderMustNotBeUsed:
        def send_otp(self, phone_number, code):
            pytest.fail("SMS must not be sent when phone encryption is misconfigured.")

    monkeypatch.setattr(
        "app.services.sms_provider.get_sms_provider",
        lambda: ProviderMustNotBeUsed(),
    )
    outputs = []
    with pytest.raises(ProvisioningError, match="valid Fernet key"):
        _verify_contact_number(
            "+15555550100",
            input_fn=lambda _prompt: pytest.fail("No OTP should be requested."),
            output_fn=outputs.append,
        )
    assert outputs == []


def test_provisioning_refuses_existing_fully_authorized_platform_admin(provisioning_database):
    engine = create_engine(f"sqlite:///{provisioning_database.as_posix()}", future=True)
    try:
        with Session(engine) as session:
            create_platform_admin_user(
                session,
                full_name="Existing Platform Admin",
                email="existing-platform@example.test",
                phone_number="+15555550100",
                phone_verified_at=utcnow(),
                password="StrongPass123",
            )
            session.commit()
    finally:
        engine.dispose()

    with pytest.raises(ProvisioningError, match="already exists"):
        provision_first_platform_admin(
            provisioning_database,
            full_name="New Platform Admin",
            email="new-platform@example.test",
            phone_number="+15555550101",
            phone_verified_at=utcnow(),
            password="StrongPass123",
            operator="maintainer",
        )

    assert _count_records(provisioning_database, "users") == 1


def test_successful_provisioning_creates_separate_platform_identity_and_audit(provisioning_database):
    user_id = provision_first_platform_admin(
        provisioning_database,
        full_name="Authorized Platform Admin",
        email="platform@example.test",
        phone_number="+15555550100",
        phone_verified_at=utcnow(),
        password="StrongPass123",
        operator="local-maintainer",
    )

    engine = create_engine(f"sqlite:///{provisioning_database.as_posix()}", future=True)
    try:
        with Session(engine) as session:
            user = session.get(User, user_id)
            assert user is not None
            assert user.email == "platform@example.test"
            assert user.is_platform_admin is True
            assert user.primary_role_id is None
            assert session.scalar(
                select(func.count()).select_from(PlatformAdmin).where(PlatformAdmin.user_id == user_id)
            ) == 1
            audit = session.scalar(
                select(AuditLog).where(AuditLog.action == "platform_super_admin_provisioned")
            )
            assert audit is not None
            assert audit.actor_user_id is None
            assert audit.tenant_id == user.tenant_id
            assert audit.resource_id == user_id
            assert audit.metadata_data == {
                "provisioning_method": "local_development_cli",
                "operator_local_account": "local-maintainer",
                "authenticated_actor": False,
            }
            assert require_platform_admin(current_user=user, db=session) == user
    finally:
        engine.dispose()


def test_provisioning_rolls_back_account_marker_and_tenant_on_audit_failure(
    provisioning_database, monkeypatch
):
    import app.provision_platform_admin as provisioning

    def fail_audit(*_args, **_kwargs):
        raise RuntimeError("simulated audit storage failure")

    monkeypatch.setattr(provisioning, "_record_provisioning_audit", fail_audit)

    with pytest.raises(RuntimeError, match="simulated audit storage failure"):
        provision_first_platform_admin(
            provisioning_database,
            full_name="Authorized Platform Admin",
            email="platform@example.test",
            phone_number="+15555550100",
            phone_verified_at=utcnow(),
            password="StrongPass123",
            operator="local-maintainer",
        )

    assert _count_records(provisioning_database, "users") == 0
    assert _count_records(provisioning_database, "platform_admins") == 0
    assert _count_records(provisioning_database, "tenants") == 0


@pytest.mark.parametrize("role_name", ["Tenant Admin", "Reviewer"])
def test_tenant_roles_do_not_count_as_platform_admins(provisioning_database, role_name):
    engine = create_engine(f"sqlite:///{provisioning_database.as_posix()}", future=True)
    try:
        with Session(engine) as session:
            tenant = Tenant(organization_name=f"{role_name} Organization")
            session.add(tenant)
            session.flush()
            role = Role(tenant_id=tenant.id, name=role_name)
            session.add(role)
            session.flush()
            user = User(
                tenant_id=tenant.id,
                name="Tenant User",
                email=f"{role_name.lower().replace(' ', '-')}@example.test",
                password_hash="not-used-by-this-test",
                status="active",
                is_platform_admin=False,
                primary_role_id=role.id,
            )
            session.add(user)
            session.commit()

            with pytest.raises(HTTPException, match="Platform admin access required"):
                require_platform_admin(current_user=user, db=session)
    finally:
        engine.dispose()

    platform_user_id = provision_first_platform_admin(
        provisioning_database,
        full_name="Authorized Platform Admin",
        email="platform@example.test",
        phone_number="+15555550100",
        phone_verified_at=utcnow(),
        password="StrongPass123",
        operator="local-maintainer",
    )
    with sqlite3.connect(provisioning_database) as connection:
        assert connection.execute(
            "SELECT is_platform_admin FROM users WHERE id = ?",
            (platform_user_id,),
        ).fetchone() == (1,)


@pytest.mark.parametrize(
    ("platform_flag", "has_platform_record"),
    [(True, False), (False, True)],
)
def test_a_single_platform_authorization_marker_is_insufficient(
    provisioning_database, platform_flag, has_platform_record
):
    engine = create_engine(f"sqlite:///{provisioning_database.as_posix()}", future=True)
    try:
        with Session(engine) as session:
            tenant = Tenant(organization_name="Marker Test Organization")
            session.add(tenant)
            session.flush()
            user = User(
                tenant_id=tenant.id,
                name="Incomplete Platform User",
                email="incomplete@example.test",
                password_hash="not-used-by-this-test",
                status="active",
                is_platform_admin=platform_flag,
            )
            session.add(user)
            session.flush()
            if has_platform_record:
                session.add(PlatformAdmin(user_id=user.id))
            session.commit()

            with pytest.raises(HTTPException, match="Platform admin access required"):
                require_platform_admin(current_user=user, db=session)
    finally:
        engine.dispose()
