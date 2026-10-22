from __future__ import annotations

import os
from pathlib import Path
from base64 import urlsafe_b64encode

import pytest
from sqlalchemy import text

os.environ["AEGISAI_TEST_MODE"] = "1"
os.environ["AEGISAI_DB_PATH"] = ":memory:"
os.environ["AEGISAI_ENV"] = "development"
os.environ["AEGISAI_SMS_PROVIDER"] = "test"
os.environ["AEGISAI_ENABLE_TEST_OTP"] = "true"
os.environ["AEGISAI_PHONE_ENCRYPTION_KEY"] = urlsafe_b64encode(bytes(range(32))).decode("ascii")

from app.db.database import Base, engine


@pytest.fixture(autouse=True)
def reset_test_database():
    """Ensure each test sees a clean SQLite schema and data set without locking a file on Windows."""
    engine.dispose()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    engine.dispose()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
