from typing import Dict, List, Literal, Optional, Union, Any
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

    # Enable / disable automatic approval
    enabled: bool = False

    # Minimum ML confidence required
    minimum_probability: float = Field(
        default=0.85,
        ge=0.0,
        le=1.0
    )

    # Maximum risk level allowed for auto approval
    maximum_risk: Literal[
        "LOW",
        "MEDIUM",
        "HIGH"
    ] = "LOW"

    # Additional governance requirements
    require_policy_compliance: bool = True

    require_fairness_pass: bool = True

    # Loan types that are allowed to be automatically approved
    eligible_loan_types: List[str] = Field(
        default_factory=lambda: [
            "PERSONAL_LOAN"
        ]
    )


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
    application_id: str = Field(
        ...,
        min_length=1,
        description="Unique loan application ID for audit tracking"
    )
    tenant_id: str

    # Supports both numeric and string features.
    #
    # Examples:
    # {
    #     "credit_score": 780,
    #     "income": 100000,
    #     "loan_amount": 200000,
    #     "age": 30,
    #     "loan_type": "PERSONAL_LOAN",
    #     "employment_type": "SALARIED"
    # }
    #
    # This is required because loan_type and employment_type
    # are categorical/string values.
    features: Dict[str, Any]

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