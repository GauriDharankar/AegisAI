from __future__ import annotations

import os
from typing import Any

import httpx


DEFAULT_BLOCKCHAIN_AUDIT_URL = "http://localhost:3000/api/audit"
BLOCKCHAIN_AUDIT_TIMEOUT_SECONDS = 10.0


def submit_blockchain_audit(audit_data: dict[str, Any]) -> dict[str, Any]:
    """Submit an audit payload without allowing blockchain failures to escape."""
    url = os.getenv("BLOCKCHAIN_AUDIT_URL", DEFAULT_BLOCKCHAIN_AUDIT_URL)
    try:
        response = httpx.post(
            url,
            json=audit_data,
            timeout=BLOCKCHAIN_AUDIT_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        result = response.json()
        if not isinstance(result, dict):
            return {
                "success": False,
                "status": "FAILED",
                "message": "Blockchain audit service returned an invalid response",
            }
        return result
    except httpx.TimeoutException:
        return {
            "success": False,
            "status": "FAILED",
            "message": "Blockchain audit service timed out",
        }
    except httpx.RequestError:
        return {
            "success": False,
            "status": "FAILED",
            "message": "Blockchain audit service unavailable",
        }
    except Exception:
        return {
            "success": False,
            "status": "FAILED",
            "message": "Blockchain audit service request failed",
        }
