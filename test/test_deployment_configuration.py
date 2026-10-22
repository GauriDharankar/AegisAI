import pytest

from app.main import configured_cors_origins


def test_cors_origins_include_localhost_and_configured_exact_origins(monkeypatch):
    monkeypatch.setenv(
        "AEGISAI_CORS_ORIGINS",
        "https://app.example.com, https://admin.example.com ",
    )

    assert configured_cors_origins() == [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "https://admin.example.com",
        "https://app.example.com",
    ]


@pytest.mark.parametrize(
    "value",
    (
        "*",
        "https://*.example.com",
        "https://app.example.com/path",
        "ftp://app.example.com",
    ),
)
def test_cors_rejects_wildcards_and_non_origin_values(monkeypatch, value):
    monkeypatch.setenv("AEGISAI_CORS_ORIGINS", value)

    with pytest.raises(ValueError, match="exact HTTP"):
        configured_cors_origins()
