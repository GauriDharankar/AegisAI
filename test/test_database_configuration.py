from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable
from sqlalchemy.pool import StaticPool

from app.db import database


def test_database_url_selects_postgresql_psycopg_driver(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://db.example.invalid/aegisai")
    monkeypatch.setenv("AEGISAI_DB_PATH", ":memory:")

    configured_url = database._configured_database_url()
    engine = database.create_database_engine(str(configured_url))
    try:
        assert configured_url.drivername == "postgresql+psycopg"
        assert engine.dialect.name == "postgresql"
        assert engine.dialect.driver == "psycopg"
    finally:
        engine.dispose()


def test_default_database_selection_remains_repository_sqlite(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("AEGISAI_DB_PATH", raising=False)

    configured_url = database._configured_database_url()

    assert configured_url.get_backend_name() == "sqlite"
    assert configured_url.database == str(database.BASE_DIR / "aegisai.db")


def test_sqlite_memory_database_retains_static_pool(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("AEGISAI_DB_PATH", ":memory:")

    engine = database.create_database_engine()
    try:
        assert engine.dialect.name == "sqlite"
        assert isinstance(engine.pool, StaticPool)
        with engine.begin() as connection:
            connection.exec_driver_sql("CREATE TABLE memory_check (id INTEGER PRIMARY KEY)")
        with engine.connect() as connection:
            assert connection.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE name = 'memory_check'"
            ).scalar_one() == "memory_check"
    finally:
        engine.dispose()


def test_postgresql_initialization_only_creates_missing_metadata(monkeypatch):
    calls = []
    postgres_engine = SimpleNamespace(dialect=SimpleNamespace(name="postgresql"))
    monkeypatch.setattr(
        database.Base.metadata,
        "create_all",
        lambda bind: calls.append(bind),
    )

    database.initialize_postgresql_schema(postgres_engine)

    assert calls == [postgres_engine]


def test_model_metadata_compiles_as_postgresql_ddl():
    database._load_models()
    statements = [
        str(CreateTable(table).compile(dialect=postgresql.dialect()))
        for table in database.Base.metadata.tables.values()
    ]

    assert any("CREATE TABLE tenants" in statement for statement in statements)
    assert any("CREATE TABLE applications" in statement for statement in statements)


def test_init_db_dispatches_postgresql_only_to_metadata_initialization(monkeypatch):
    calls = []
    postgres_engine = SimpleNamespace(dialect=SimpleNamespace(name="postgresql"))
    monkeypatch.setattr(database, "engine", postgres_engine)
    monkeypatch.setattr(
        database.Base.metadata,
        "create_all",
        lambda bind: calls.append(("create_all", bind)),
    )
    for migration_name in (
        "migrate_sqlite_application_schema",
        "migrate_sqlite_tenant_schema",
        "migrate_sqlite_user_schema",
        "migrate_sqlite_review_schema",
    ):
        monkeypatch.setattr(
            database,
            migration_name,
            lambda *_args: pytest.fail("SQLite migrations must not run on PostgreSQL"),
        )

    database.init_db()

    assert calls == [("create_all", postgres_engine)]


def test_postgresql_initialization_rejects_non_postgresql_engines():
    sqlite_engine = create_engine("sqlite://")
    try:
        with pytest.raises(ValueError, match="requires a PostgreSQL engine"):
            database.initialize_postgresql_schema(sqlite_engine)
    finally:
        sqlite_engine.dispose()


@pytest.mark.parametrize(
    "migration",
    (
        database.migrate_sqlite_application_schema,
        database.migrate_sqlite_tenant_schema,
        database.migrate_sqlite_user_schema,
        database.migrate_sqlite_review_schema,
    ),
)
def test_sqlite_migrations_refuse_postgresql_engine(migration):
    postgres_engine = SimpleNamespace(dialect=SimpleNamespace(name="postgresql"))

    with pytest.raises(ValueError, match="only support SQLite"):
        migration(postgres_engine)
