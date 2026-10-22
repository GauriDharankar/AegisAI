from __future__ import annotations

import uuid
from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api import platform_admin as platform_admin_api
from app.db.database import SessionLocal
from app.db.models import PasswordResetChallenge, User, utcnow
from app.main import app
from app.services.auth_service import create_platform_admin_user, create_session_token
from app.services.phone_service import decrypt_phone_number
from app.services.sms_provider import SmsConfigurationError, SmsDeliveryError, get_sms_provider

client = TestClient(app)
REGISTERED_PHONE = "+15555550100"
PLATFORM_PASSWORD = "SecurePass123"


def _create_platform_admin(phone_number: str = REGISTERED_PHONE) -> tuple[User, str]:
    with SessionLocal() as db:
        user = create_platform_admin_user(
            db,
            full_name="Platform Super Admin",
            email=f"platform_{uuid.uuid4().hex[:8]}@example.com",
            password=PLATFORM_PASSWORD,
            phone_number=phone_number,
            phone_verified_at=utcnow(),
        )
        db.commit()
        return user, create_session_token(user, role_name="Super Admin")


def _register_tenant() -> dict:
    email = f"tenant_{uuid.uuid4().hex[:8]}@example.com"
    response = client.post(
        "/api/v1/auth/register",
        json={
            "organization_name": f"Tenant {uuid.uuid4().hex[:8]}",
            "name": "Tenant Admin",
            "email": email,
            "password": "SecurePass123",
            "confirm_password": "SecurePass123",
        },
    )
    assert response.status_code == 200, response.text
    return {"email": email, **response.json()}


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _start_reset(phone_number: str = REGISTERED_PHONE) -> str:
    response = client.post(
        "/api/v1/platform-admin/password-reset/start",
        json={"phone_number": phone_number},
    )
    assert response.status_code == 202, response.text
    code = response.json().get("development_otp")
    assert code is not None
    return code


def _verify_reset(phone_number: str, code: str) -> str:
    response = client.post(
        "/api/v1/platform-admin/password-reset/verify",
        json={"phone_number": phone_number, "code": code},
    )
    assert response.status_code == 200, response.text
    return response.json()["reset_token"]


def test_platform_admin_login_is_separate_from_tenant_login():
    admin, _ = _create_platform_admin()
    tenant = _register_tenant()

    admin_login = client.post(
        "/api/v1/platform-admin/login",
        json={"email": admin.email, "password": PLATFORM_PASSWORD},
    )
    assert admin_login.status_code == 200, admin_login.text
    assert admin_login.json()["user"]["role"] == "Super Admin"

    tenant_on_platform_login = client.post(
        "/api/v1/platform-admin/login",
        json={"email": tenant["email"], "password": "SecurePass123"},
    )
    assert tenant_on_platform_login.status_code == 401

    tenant_login = client.post(
        "/api/v1/auth/login",
        json={"email": tenant["email"], "password": "SecurePass123"},
    )
    assert tenant_login.status_code == 200
    assert tenant_login.json()["user"]["role"] == "Tenant Admin"

    admin_on_tenant_login = client.post(
        "/api/v1/auth/login",
        json={"email": admin.email, "password": PLATFORM_PASSWORD},
    )
    assert admin_on_tenant_login.status_code == 401
    assert client.get("/api/v1/platform-admin/tenants", headers=_headers(tenant_login.json()["token"])).status_code == 403


def test_platform_admin_can_change_password_and_old_sessions_are_revoked():
    admin, token = _create_platform_admin()
    response = client.post(
        "/api/v1/platform-admin/password/change",
        headers=_headers(token),
        json={
            "current_password": PLATFORM_PASSWORD,
            "new_password": "NewSecure456",
            "confirm_password": "NewSecure456",
        },
    )
    assert response.status_code == 200, response.text
    assert client.get("/api/v1/auth/me", headers=_headers(token)).status_code == 401
    assert client.post(
        "/api/v1/platform-admin/login",
        json={"email": admin.email, "password": PLATFORM_PASSWORD},
    ).status_code == 401
    assert client.post(
        "/api/v1/platform-admin/login",
        json={"email": admin.email, "password": "NewSecure456"},
    ).status_code == 200


def test_platform_admin_rejects_incorrect_current_password_without_revoking_session():
    _, token = _create_platform_admin()
    response = client.post(
        "/api/v1/platform-admin/password/change",
        headers=_headers(token),
        json={
            "current_password": "IncorrectPass123",
            "new_password": "NewSecure456",
            "confirm_password": "NewSecure456",
        },
    )
    assert response.status_code == 400
    assert client.get("/api/v1/auth/me", headers=_headers(token)).status_code == 200


def test_recovery_delivers_only_to_the_previously_verified_phone():
    admin, _ = _create_platform_admin()
    sent_numbers: list[str] = []

    class RecordingProvider:
        def send_otp(self, phone_number: str, code: str):
            sent_numbers.append(phone_number)
            from app.services.sms_provider import SmsDelivery

            return SmsDelivery(development_code=code)

    original_provider = platform_admin_api.get_sms_provider
    platform_admin_api.get_sms_provider = lambda: RecordingProvider()
    try:
        code = _start_reset()
        assert sent_numbers == [REGISTERED_PHONE]
        resent = client.post(
            "/api/v1/platform-admin/password-reset/start",
            json={"phone_number": REGISTERED_PHONE},
        )
        assert resent.status_code == 202
        assert "development_otp" not in resent.json()
        assert sent_numbers == [REGISTERED_PHONE]

        with SessionLocal() as db:
            stored = db.get(User, admin.id)
            assert stored is not None
            assert stored.phone_number_encrypted != REGISTERED_PHONE
            assert decrypt_phone_number(stored.phone_number_encrypted) == REGISTERED_PHONE
            challenge = db.scalar(select(PasswordResetChallenge))
            assert challenge is not None
            assert challenge.code_hash != code

        different_number = client.post(
            "/api/v1/platform-admin/password-reset/start",
            json={"phone_number": "+15555550199"},
        )
        assert different_number.status_code == 202
        assert "development_otp" not in different_number.json()
        assert sent_numbers == [REGISTERED_PHONE]
    finally:
        platform_admin_api.get_sms_provider = original_provider


def test_wrong_expired_reused_and_rate_limited_codes_are_rejected():
    _create_platform_admin()
    code = _start_reset()

    for _ in range(5):
        invalid = client.post(
            "/api/v1/platform-admin/password-reset/verify",
            json={"phone_number": REGISTERED_PHONE, "code": "000000" if code != "000000" else "000001"},
        )
        assert invalid.status_code == 400
    rate_limited = client.post(
        "/api/v1/platform-admin/password-reset/verify",
        json={"phone_number": REGISTERED_PHONE, "code": code},
    )
    assert rate_limited.status_code == 429

    with SessionLocal() as db:
        challenge = db.scalar(select(PasswordResetChallenge))
        assert challenge is not None
        challenge.attempts = 0
        challenge.expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
    expired = client.post(
        "/api/v1/platform-admin/password-reset/verify",
        json={"phone_number": REGISTERED_PHONE, "code": code},
    )
    assert expired.status_code == 400


def test_verified_code_is_single_use_and_allows_one_password_reset():
    admin, old_token = _create_platform_admin()
    code = _start_reset()
    reset_token = _verify_reset(REGISTERED_PHONE, code)
    reused = client.post(
        "/api/v1/platform-admin/password-reset/verify",
        json={"phone_number": REGISTERED_PHONE, "code": code},
    )
    assert reused.status_code == 400

    reset = client.post(
        "/api/v1/platform-admin/password-reset/confirm",
        json={
            "reset_token": reset_token,
            "new_password": "RecoveredPass789",
            "confirm_password": "RecoveredPass789",
        },
    )
    assert reset.status_code == 200, reset.text
    assert client.get("/api/v1/auth/me", headers=_headers(old_token)).status_code == 401
    assert client.post(
        "/api/v1/platform-admin/login",
        json={"email": admin.email, "password": "RecoveredPass789"},
    ).status_code == 200
    reused_reset = client.post(
        "/api/v1/platform-admin/password-reset/confirm",
        json={
            "reset_token": reset_token,
            "new_password": "AnotherSecure789",
            "confirm_password": "AnotherSecure789",
        },
    )
    assert reused_reset.status_code == 400


def test_sms_delivery_failure_does_not_issue_a_reset_challenge(monkeypatch):
    _create_platform_admin()

    class FailingProvider:
        def send_otp(self, phone_number: str, code: str):
            raise SmsDeliveryError("provider unavailable")

    monkeypatch.setattr(platform_admin_api, "get_sms_provider", lambda: FailingProvider())
    response = client.post(
        "/api/v1/platform-admin/password-reset/start",
        json={"phone_number": REGISTERED_PHONE},
    )
    assert response.status_code == 503
    assert "development_otp" not in response.json()
    with SessionLocal() as db:
        challenge = db.scalar(select(PasswordResetChallenge))
        assert challenge is not None
        assert challenge.delivery_status == "failed"
    verify = client.post(
        "/api/v1/platform-admin/password-reset/verify",
        json={"phone_number": REGISTERED_PHONE, "code": "123456"},
    )
    assert verify.status_code == 400


def test_recovery_does_not_use_an_unverified_phone_number():
    _create_platform_admin()
    with SessionLocal() as db:
        admin = db.scalar(select(User).where(User.is_platform_admin.is_(True)))
        assert admin is not None
        admin.phone_number_encrypted = None
        admin.phone_number_hash = None
        admin.phone_verified_at = None
        db.commit()

    response = client.post(
        "/api/v1/platform-admin/password-reset/start",
        json={"phone_number": REGISTERED_PHONE},
    )
    assert response.status_code == 202
    assert "development_otp" not in response.json()


def test_test_sms_provider_is_refused_when_any_production_marker_is_set(monkeypatch):
    monkeypatch.setenv("AEGISAI_SMS_PROVIDER", "test")
    monkeypatch.setenv("AEGISAI_ENV", "development")
    monkeypatch.setenv("NODE_ENV", "production")
    monkeypatch.setenv("AEGISAI_ENABLE_TEST_OTP", "true")
    try:
        get_sms_provider()
    except SmsConfigurationError:
        return
    raise AssertionError("The test SMS provider must be disabled in production.")


def test_platform_admin_api_requires_authorized_markers():
    response = client.get("/api/v1/platform-admin/tenants")
    assert response.status_code == 401

    tenant = _register_tenant()
    tenant_headers = _headers(tenant["token"])
    assert client.get("/api/v1/platform-admin/tenants", headers=tenant_headers).status_code == 403

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == tenant["email"]))
        assert user is not None
        user.is_platform_admin = True
        db.commit()
        token = create_session_token(user, role_name="Super Admin")
    assert client.get("/api/v1/platform-admin/tenants", headers=_headers(token)).status_code == 403
