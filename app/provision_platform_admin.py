from __future__ import annotations

import argparse
import getpass
import os
import sqlite3
import sys
import secrets
import hmac
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Mapping
from urllib.parse import quote

from sqlalchemy import URL, create_engine, select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

OPT_IN_VARIABLE = "AEGISAI_ALLOW_LOCAL_PLATFORM_ADMIN_PROVISIONING"
OPT_IN_VALUE = "I_ACKNOWLEDGE_LOCAL_DEVELOPMENT_ONLY"
ENVIRONMENT_VARIABLE = "AEGISAI_ENV"
DATABASE_VARIABLE = "AEGISAI_DB_PATH"
PHONE_ENROLLMENT_VARIABLE = "AEGISAI_ALLOW_PLATFORM_ADMIN_PHONE_ENROLLMENT"
PHONE_ENROLLMENT_VALUE = "I_ACKNOWLEDGE_PRIVILEGED_ACCOUNT_PHONE_UPDATE"
REQUIRED_TABLES = {"users", "tenants", "platform_admins", "audit_logs", "platform_audit_logs"}


class ProvisioningError(Exception):
    pass


def resolve_target_database(environment: Mapping[str, str]) -> Path:
    if environment.get(OPT_IN_VARIABLE) != OPT_IN_VALUE:
        raise ProvisioningError(f"Set {OPT_IN_VARIABLE}={OPT_IN_VALUE} to opt in.")

    if environment.get(ENVIRONMENT_VARIABLE, "").strip().lower() != "development":
        raise ProvisioningError(f"{ENVIRONMENT_VARIABLE} must be set to development.")

    for variable in ("APP_ENV", "ENVIRONMENT", "NODE_ENV"):
        value = environment.get(variable)
        if value and value.strip().lower() not in {"development", "dev", "local"}:
            raise ProvisioningError(f"Refusing to run because {variable} is not development-only.")

    raw_path = environment.get(DATABASE_VARIABLE, "").strip()
    if not raw_path or raw_path.lower() == ":memory:":
        raise ProvisioningError(f"Set {DATABASE_VARIABLE} to an explicit existing SQLite file.")

    configured_path = Path(raw_path).expanduser()
    if not configured_path.is_absolute():
        raise ProvisioningError(f"{DATABASE_VARIABLE} must be an absolute path.")
    try:
        database_path = configured_path.resolve(strict=True)
    except OSError as exc:
        raise ProvisioningError("The configured SQLite database file does not exist or is inaccessible.") from exc
    if not database_path.is_file():
        raise ProvisioningError("The configured database path must refer to an existing SQLite file.")
    return database_path


def resolve_phone_enrollment_database(environment: Mapping[str, str]) -> Path:
    if environment.get(PHONE_ENROLLMENT_VARIABLE) != PHONE_ENROLLMENT_VALUE:
        raise ProvisioningError(
            f"Set {PHONE_ENROLLMENT_VARIABLE}={PHONE_ENROLLMENT_VALUE} to opt in."
        )
    if not environment.get(ENVIRONMENT_VARIABLE, "").strip():
        raise ProvisioningError(f"{ENVIRONMENT_VARIABLE} must explicitly identify the target environment.")

    raw_path = environment.get(DATABASE_VARIABLE, "").strip()
    if not raw_path or raw_path.lower() == ":memory:":
        raise ProvisioningError(f"Set {DATABASE_VARIABLE} to an explicit existing SQLite file.")
    configured_path = Path(raw_path).expanduser()
    if not configured_path.is_absolute():
        raise ProvisioningError(f"{DATABASE_VARIABLE} must be an absolute path.")
    try:
        database_path = configured_path.resolve(strict=True)
    except OSError as exc:
        raise ProvisioningError("The configured SQLite database file does not exist or is inaccessible.") from exc
    if not database_path.is_file():
        raise ProvisioningError("The configured database path must refer to an existing SQLite file.")
    return database_path


def _verify_existing_schema(database_path: Path) -> None:
    database_uri = f"file:{quote(database_path.as_posix(), safe=':/')}?mode=ro"
    connection = None
    try:
        connection = sqlite3.connect(database_uri, uri=True)
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
        missing_tables = REQUIRED_TABLES - tables
        if missing_tables:
            missing = ", ".join(sorted(missing_tables))
            raise ProvisioningError(
                f"Database schema is not initialized; missing tables: {missing}. "
                "Start the application normally before provisioning."
            )
        user_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(users)")
        }
        required_user_columns = {
            "is_platform_admin",
            "phone_number_encrypted",
            "phone_number_hash",
            "phone_verified_at",
        }
        if not required_user_columns.issubset(user_columns):
            raise ProvisioningError(
                "Database schema is missing Platform Admin security columns; "
                "run the normal application migration before provisioning."
            )
    except sqlite3.Error as exc:
        raise ProvisioningError("The configured file is not a readable SQLite database.") from exc
    finally:
        if connection is not None:
            connection.close()


def _record_provisioning_audit(session: Session, user_id: str, tenant_id: str, operator: str) -> None:
    from app.db.models import AuditLog

    session.add(
        AuditLog(
            tenant_id=tenant_id,
            actor_user_id=None,
            action="platform_super_admin_provisioned",
            resource_type="platform_admin",
            resource_id=user_id,
            metadata_data={
                "provisioning_method": "local_development_cli",
                "operator_local_account": operator,
                "authenticated_actor": False,
            },
        )
    )


def provision_first_platform_admin(
    database_path: Path,
    *,
    full_name: str,
    email: str,
    password: str,
    phone_number: str,
    phone_verified_at: datetime,
    operator: str,
) -> str:
    _verify_existing_schema(database_path)

    from app.db.models import PlatformAdmin, User
    from app.services.auth_service import create_platform_admin_user

    engine = create_engine(
        URL.create("sqlite", database=str(database_path)),
        connect_args={"check_same_thread": False},
        future=True,
    )
    try:
        with engine.connect() as connection:
            connection.exec_driver_sql("BEGIN IMMEDIATE")
            session = Session(bind=connection, join_transaction_mode="control_fully")
            try:
                with session.begin():
                    existing_admin_id = session.execute(
                        select(User.id)
                        .join(PlatformAdmin, PlatformAdmin.user_id == User.id)
                        .where(User.is_platform_admin.is_(True))
                        .limit(1)
                    ).scalar_one_or_none()
                    if existing_admin_id is not None:
                        raise ProvisioningError(
                            "An authorized Platform Super Admin already exists; refusing additional bootstrap."
                        )

                    user = create_platform_admin_user(
                        session,
                        full_name=full_name,
                        email=email,
                        password=password,
                        phone_number=phone_number,
                        phone_verified_at=phone_verified_at,
                    )
                    _record_provisioning_audit(
                        session,
                        user_id=user.id,
                        tenant_id=user.tenant_id,
                        operator=operator,
                    )
                    session.flush()
                    created_user_id = user.id
            finally:
                session.close()
        return created_user_id
    except SQLAlchemyError as exc:
        raise ProvisioningError(
            "Provisioning failed; the transaction was rolled back and no account was created."
        ) from exc
    finally:
        engine.dispose()


def run_interactive(
    environment: Mapping[str, str],
    *,
    input_fn: Callable[[str], str] = input,
    password_fn: Callable[[str], str] = getpass.getpass,
    output_fn: Callable[[str], None] = print,
) -> int:
    database_path = resolve_target_database(environment)
    output_fn(f"Target SQLite database: {database_path}")
    if input_fn("Type the exact database path to confirm: ").strip() != str(database_path):
        raise ProvisioningError("Database path confirmation did not match; no changes were made.")

    full_name = input_fn("Authorized maintainer's full name: ").strip()
    email = input_fn("Platform Super Admin email: ").strip()
    phone_number = input_fn("Platform Super Admin mobile number (E.164): ").strip()
    phone_verified_at = _verify_contact_number(phone_number, input_fn=input_fn, output_fn=output_fn)
    password = password_fn("New password (input hidden): ")
    confirmation = password_fn("Confirm new password (input hidden): ")
    if password != confirmation:
        raise ProvisioningError("Passwords did not match; no changes were made.")

    operator = getpass.getuser()
    user_id = provision_first_platform_admin(
        database_path,
        full_name=full_name,
        email=email,
        password=password,
        phone_number=phone_number,
        phone_verified_at=phone_verified_at,
        operator=operator,
    )
    output_fn(
        f"Platform Super Admin provisioned for {email.strip().lower()} "
        f"(user ID {user_id}). No password was logged."
    )
    return 0


def _verify_contact_number(
    phone_number: str,
    *,
    input_fn: Callable[[str], str],
    output_fn: Callable[[str], None],
) -> datetime:
    from app.services.phone_service import (
        PhoneConfigurationError,
        normalize_phone_number,
        validate_phone_encryption_key,
    )
    from app.services.sms_provider import SmsConfigurationError, SmsDeliveryError, get_sms_provider

    try:
        validate_phone_encryption_key()
        normalized_phone = normalize_phone_number(phone_number)
        code = f"{secrets.randbelow(1_000_000):06d}"
        delivery = get_sms_provider().send_otp(normalized_phone, code)
    except (PhoneConfigurationError, SmsConfigurationError, SmsDeliveryError, ValueError) as exc:
        raise ProvisioningError(f"Unable to verify the contact number: {exc}") from exc

    if delivery.development_code is not None:
        output_fn(f"Development-only test OTP: {delivery.development_code}")
    supplied_code = input_fn("Enter the verification code sent to that mobile: ").strip()
    if not hmac.compare_digest(supplied_code, code):
        raise ProvisioningError("Phone verification failed; no Platform Super Admin was created.")
    return datetime.now(timezone.utc)


def enroll_existing_platform_admin_phone(
    database_path: Path,
    *,
    email: str,
    phone_number: str,
    operator: str,
    phone_verified_at: datetime,
) -> None:
    from app.db.models import PasswordResetChallenge, PlatformAdmin, PlatformAuditLog, User
    from app.services.phone_service import (
        PhoneConfigurationError,
        encrypt_phone_number,
        hash_phone_number,
        normalize_phone_number,
        validate_phone_encryption_key,
    )

    try:
        validate_phone_encryption_key()
    except PhoneConfigurationError as exc:
        raise ProvisioningError(str(exc)) from exc
    _verify_existing_schema(database_path)
    normalized_email = email.strip().lower()
    normalized_phone = normalize_phone_number(phone_number)
    engine = create_engine(
        URL.create("sqlite", database=str(database_path)),
        connect_args={"check_same_thread": False},
        future=True,
    )
    try:
        with Session(engine) as session:
            user = session.execute(
                select(User)
                .join(PlatformAdmin, PlatformAdmin.user_id == User.id)
                .where(User.email == normalized_email, User.is_platform_admin.is_(True))
            ).scalar_one_or_none()
            if user is None:
                raise ProvisioningError("No fully authorized Platform Super Admin matched that email.")
            user.phone_number_encrypted = encrypt_phone_number(normalized_phone)
            user.phone_number_hash = hash_phone_number(normalized_phone)
            user.phone_verified_at = phone_verified_at
            user.session_version += 1
            now = datetime.now(timezone.utc)
            session.execute(
                update(PasswordResetChallenge)
                .where(PasswordResetChallenge.user_id == user.id)
                .values(expires_at=now, reset_token_hash=None, reset_expires_at=now)
                .execution_options(synchronize_session=False)
            )
            session.add(
                PlatformAuditLog(
                    actor_user_id=user.id,
                    tenant_id=user.tenant_id,
                    action="platform_super_admin_phone_enrolled",
                    resource_type="platform_admin_account",
                    resource_id=user.id,
                    metadata_data={
                        "provisioning_method": "local_development_cli",
                        "operator_local_account": operator,
                    },
                )
            )
            session.commit()
    except SQLAlchemyError as exc:
        raise ProvisioningError("Phone enrollment failed; no account changes were committed.") from exc
    finally:
        engine.dispose()


def run_phone_enrollment(
    environment: Mapping[str, str],
    *,
    input_fn: Callable[[str], str] = input,
    output_fn: Callable[[str], None] = print,
) -> int:
    database_path = resolve_phone_enrollment_database(environment)
    output_fn(f"Target SQLite database: {database_path}")
    if input_fn("Type the exact database path to confirm: ").strip() != str(database_path):
        raise ProvisioningError("Database path confirmation did not match; no changes were made.")

    email = input_fn("Existing Platform Super Admin email: ").strip()
    phone_number = input_fn("New mobile number (E.164): ").strip()
    verified_at = _verify_contact_number(phone_number, input_fn=input_fn, output_fn=output_fn)
    enroll_existing_platform_admin_phone(
        database_path,
        email=email,
        phone_number=phone_number,
        operator=getpass.getuser(),
        phone_verified_at=verified_at,
    )
    output_fn("Verified phone enrollment completed. Existing sessions were revoked.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Securely provision or enroll a Platform Super Admin.")
    parser.add_argument(
        "--enroll-phone",
        action="store_true",
        help="Verify and enroll a phone for an existing Platform Super Admin.",
    )
    args = parser.parse_args()
    try:
        if args.enroll_phone:
            return run_phone_enrollment(os.environ)
        return run_interactive(os.environ)
    except (ProvisioningError, ValueError, OSError, EOFError, SQLAlchemyError) as exc:
        print(f"Provisioning refused or failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
