from __future__ import annotations

from typing import Any

from app.db.models import Tenant


DEFAULT_AUTO_APPROVE_CONFIGURATION = {
    "enabled": False,
    "minimum_probability": 0.85,
    "maximum_risk": "LOW",
    "eligible_loan_types": [],
    "require_policy_compliance": True,
    "require_fairness_pass": True,
}


def get_tenant_governance_configuration(tenant: Tenant) -> dict[str, Any]:
    stored = dict(tenant.governance_configuration or {})
    auto_approve = dict(stored.get("auto_approve") or {})
    configuration = dict(DEFAULT_AUTO_APPROVE_CONFIGURATION)
    configuration.update(auto_approve)
    return {"auto_approve": configuration}