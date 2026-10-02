import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _unique_org_name(prefix: str = "Auth Org") -> str:
    return f"{prefix} {uuid.uuid4().hex[:8]}"


def test_register_new_organization_success():
    org_name = _unique_org_name("Register")
    email = f"admin_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "organization_name": org_name,
        "name": "Test Admin",
        "email": email,
        "password": "SecurePass123",
        "confirm_password": "SecurePass123",
    }

    response = client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["tenant"]["organization_name"] == org_name
    assert data["user"]["email"] == email.lower()
    assert data["user"]["role"] == "Tenant Admin"
    assert data["token"]


def test_duplicate_email_is_rejected():
    org_name = _unique_org_name("Duplicate")
    email = f"dup_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "organization_name": org_name,
        "name": "Primary User",
        "email": email,
        "password": "SecurePass123",
        "confirm_password": "SecurePass123",
    }

    first = client.post("/api/v1/auth/register", json=payload)
    assert first.status_code == 200, first.text

    duplicate = client.post("/api/v1/auth/register", json=payload)
    assert duplicate.status_code == 400, duplicate.text


def test_login_success_and_invalid_password():
    org_name = _unique_org_name("Login")
    email = f"login_{uuid.uuid4().hex[:8]}@example.com"
    password = "SecurePass123"

    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "organization_name": org_name,
            "name": "Login User",
            "email": email,
            "password": password,
            "confirm_password": password,
        },
    )
    assert register_response.status_code == 200, register_response.text

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_response.status_code == 200, login_response.text
    login_data = login_response.json()
    assert login_data["user"]["email"] == email.lower()
    assert login_data["token"]

    wrong_password_response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "WrongPass123"},
    )
    assert wrong_password_response.status_code == 401, wrong_password_response.text


def test_inactive_user_login_fails():
    org_name = _unique_org_name("Inactive")
    email = f"inactive_{uuid.uuid4().hex[:8]}@example.com"
    password = "SecurePass123"

    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "organization_name": org_name,
            "name": "Inactive User",
            "email": email,
            "password": password,
            "confirm_password": password,
        },
    )
    assert register_response.status_code == 200, register_response.text

    from app.db.database import SessionLocal
    from app.db.models import User

    session = SessionLocal()
    try:
        user = session.query(User).filter(User.email == email.lower()).one()
        user.status = "inactive"
        session.commit()
    finally:
        session.close()

    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 401, response.text


def test_protected_route_requires_auth():
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401, response.text


def test_authenticated_user_receives_correct_tenant_context():
    org_name = _unique_org_name("Tenant Context")
    email = f"tenant_{uuid.uuid4().hex[:8]}@example.com"
    password = "SecurePass123"

    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "organization_name": org_name,
            "name": "Tenant User",
            "email": email,
            "password": password,
            "confirm_password": password,
        },
    )
    assert register_response.status_code == 200, register_response.text
    token = register_response.json()["token"]

    me_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_response.status_code == 200, me_response.text
    payload = me_response.json()
    assert payload["email"] == email.lower()
    assert payload["role"] == "Tenant Admin"
    assert payload["tenant_name"] == org_name


def test_logout_invalidates_session():
    org_name = _unique_org_name("Logout")
    email = f"logout_{uuid.uuid4().hex[:8]}@example.com"
    password = "SecurePass123"

    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "organization_name": org_name,
            "name": "Logout User",
            "email": email,
            "password": password,
            "confirm_password": password,
        },
    )
    assert register_response.status_code == 200, register_response.text
    token = register_response.json()["token"]

    logout_response = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert logout_response.status_code == 200, logout_response.text

    me_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_response.status_code == 401, me_response.text


def test_password_is_hashed_not_plaintext():
    org_name = _unique_org_name("Hash")
    email = f"hash_{uuid.uuid4().hex[:8]}@example.com"
    password = "SecurePass123"

    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "organization_name": org_name,
            "name": "Hash User",
            "email": email,
            "password": password,
            "confirm_password": password,
        },
    )
    assert register_response.status_code == 200, register_response.text

    from app.db.database import SessionLocal
    from app.db.models import User

    session = SessionLocal()
    try:
        user = session.query(User).filter(User.email == email.lower()).one()
        assert user.password_hash != password
        assert "pbkdf2_sha256$" in user.password_hash
    finally:
        session.close()
