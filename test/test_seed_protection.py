from sqlalchemy import select

from app.db import seed
from app.db.database import SessionLocal
from app.db.models import Tenant, User


def test_demo_seed_is_skipped_when_any_environment_marker_is_production(monkeypatch):
    monkeypatch.delenv("AEGISAI_TEST_MODE", raising=False)
    monkeypatch.setenv("AEGISAI_ENV", "development")
    monkeypatch.setenv("NODE_ENV", "production")

    seed.seed_demo_data()

    with SessionLocal() as session:
        assert session.scalar(select(Tenant.id).limit(1)) is None
        assert session.scalar(select(User.id).limit(1)) is None


def test_demo_seed_remains_available_in_local_development(monkeypatch):
    monkeypatch.delenv("AEGISAI_TEST_MODE", raising=False)
    monkeypatch.setenv("AEGISAI_ENV", "development")
    for name in ("APP_ENV", "ENVIRONMENT", "NODE_ENV"):
        monkeypatch.delenv(name, raising=False)

    seed.seed_demo_data()

    with SessionLocal() as session:
        assert session.query(Tenant).count() == 2
        assert session.query(User).count() == 10
