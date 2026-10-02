from __future__ import annotations

import os
from pathlib import Path

import pytest
from sqlalchemy import text

os.environ["AEGISAI_TEST_MODE"] = "1"

os.environ["AEGISAI_DB_PATH"] = ":memory:"

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
