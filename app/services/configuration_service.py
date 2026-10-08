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

DEFAULT_RISK_ROUTING_CONFIGURATION = {
    "enabled": False,
    "default_team_id": None,
    "low_risk_team_id": None,
    "medium_risk_team_id": None,
    "high_risk_team_id": None,
    "review_stage": "RISK_REVIEW",
}


def get_tenant_governance_configuration(tenant: Tenant) -> dict[str, Any]:
    stored = dict(tenant.governance_configuration or {})
    auto_approve = dict(stored.get("auto_approve") or {})
    risk_routing = dict(stored.get("risk_routing") or {})

    auto_config = dict(DEFAULT_AUTO_APPROVE_CONFIGURATION)
    auto_config.update(auto_approve)

    risk_config = dict(DEFAULT_RISK_ROUTING_CONFIGURATION)
    risk_config.update(risk_routing)

    return {"auto_approve": auto_config, "risk_routing": risk_config}