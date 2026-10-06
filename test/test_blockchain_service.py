import httpx

from app.services import blockchain_service


def test_submit_blockchain_audit_returns_service_response(monkeypatch):
    captured = {}

    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "success": True,
                "status": "RECORDED",
                "audit_hash": "hash-1",
            }

    def post(url, *, json, timeout):
        captured.update({"url": url, "json": json, "timeout": timeout})
        return Response()

    monkeypatch.setattr(blockchain_service.httpx, "post", post)

    result = blockchain_service.submit_blockchain_audit({"application_id": "APP-1"})

    assert result["success"] is True
    assert captured["url"] == blockchain_service.DEFAULT_BLOCKCHAIN_AUDIT_URL
    assert captured["json"] == {"application_id": "APP-1"}
    assert captured["timeout"] == blockchain_service.BLOCKCHAIN_AUDIT_TIMEOUT_SECONDS


def test_submit_blockchain_audit_returns_failure_on_connection_error(monkeypatch):
    def post(*args, **kwargs):
        raise httpx.ConnectError("offline")

    monkeypatch.setattr(blockchain_service.httpx, "post", post)

    result = blockchain_service.submit_blockchain_audit({"application_id": "APP-1"})

    assert result == {
        "success": False,
        "status": "FAILED",
        "message": "Blockchain audit service unavailable",
    }


def test_submit_blockchain_audit_never_raises_unexpected_errors(monkeypatch):
    def post(*args, **kwargs):
        raise RuntimeError("unexpected")

    monkeypatch.setattr(blockchain_service.httpx, "post", post)

    result = blockchain_service.submit_blockchain_audit({"application_id": "APP-1"})

    assert result["success"] is False
    assert result["status"] == "FAILED"
