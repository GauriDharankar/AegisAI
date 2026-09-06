from typing import Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field


# ============================================================
# ML PREDICTION
# ============================================================

class PredictionInput(BaseModel):
    label: Literal["approve", "reject"]

    probability: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Probability of loan approval"
    )


# ============================================================
# FAIRNESS CONFIGURATION
# ============================================================

class FairnessConfig(BaseModel):
    enabled: bool = True

    metric: Literal[
        "demographic_parity"
    ] = "demographic_parity"

    threshold: float = Field(
        default=0.10,
        ge=0.0,
        le=1.0,
        description="Maximum allowed difference between group approval rates"
    )

    minimum_group_size: int = Field(
        default=1,
        ge=1,
        description="Minimum number of applicants required per protected group"
    )


class FairnessInput(BaseModel):
    predictions: List[int] = Field(
        default_factory=list
    )

    protected_groups: List[str] = Field(
        default_factory=list
    )

    config: FairnessConfig = Field(
        default_factory=FairnessConfig
    )


# ============================================================
# POLICY RULE
# ============================================================

class PolicyRule(BaseModel):
    """
    Generic tenant-defined governance policy.

    Example:

    {
        "policy_id": "POL-001",
        "name": "Minimum Credit Score",
        "field": "credit_score",
        "operator": ">=",
        "value": 650,
        "action": "REJECT",
        "severity": "HIGH",
        "enabled": true
    }
    """

    policy_id: str

    name: str

    field: str

    operator: Literal[
        ">",
        ">=",
        "<",
        "<=",
        "==",
        "!="
    ]

    value: Union[float, int, str, bool]

    action: Literal[
        "APPROVE",
        "REJECT",
        "REVIEW",
        "FLAG"
    ] = "REVIEW"

    severity: Literal[
        "LOW",
        "MEDIUM",
        "HIGH",
        "CRITICAL"
    ] = "MEDIUM"

    enabled: bool = True

    description: Optional[str] = None


# ============================================================
# RISK CONFIGURATION
# ============================================================

class RiskConfig(BaseModel):
    enabled: bool = True

    low_probability: float = Field(
        default=0.85,
        ge=0.0,
        le=1.0
    )

    medium_probability: float = Field(
        default=0.65,
        ge=0.0,
        le=1.0
    )


# ============================================================
# AUTO APPROVAL CONFIGURATION
# ============================================================

class AutoApproveConfig(BaseModel):

    enabled: bool = False

    minimum_probability: float = Field(
        default=0.85,
        ge=0.0,
        le=1.0
    )

    maximum_risk: Literal[
        "LOW",
        "MEDIUM",
        "HIGH"
    ] = "LOW"

    require_policy_compliance: bool = True

    require_fairness_pass: bool = True


# ============================================================
# COMPLETE GOVERNANCE CONFIGURATION
# ============================================================

class GovernanceConfig(BaseModel):

    fairness: FairnessConfig = Field(
        default_factory=FairnessConfig
    )

    risk: RiskConfig = Field(
        default_factory=RiskConfig
    )

    auto_approve: AutoApproveConfig = Field(
        default_factory=AutoApproveConfig
    )


# ============================================================
# GOVERNANCE REQUEST
# ============================================================

class GovernanceRequest(BaseModel):

    tenant_id: str

    features: Dict[str, float]

    prediction: PredictionInput

    fairness: FairnessInput = Field(
        default_factory=FairnessInput
    )

    policies: List[PolicyRule] = Field(
        default_factory=list
    )

    configuration: GovernanceConfig = Field(
        default_factory=GovernanceConfig
    )