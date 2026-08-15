from pydantic import BaseModel, Field
from typing import Dict, List


class PredictionInput(BaseModel):

    label: str = Field(
        ...,
        description="ML model prediction: approve or reject"
    )

    probability: float = Field(
        ...,
        ge=0.0,
        le=1.0
    )


class FairnessInput(BaseModel):

    predictions: List[int]

    protected_groups: List[str]

    threshold: float = Field(
        default=0.10,
        ge=0.0,
        le=1.0
    )


class AutoApproveConfig(BaseModel):

    enabled: bool = False

    minimum_probability: float = Field(
        default=0.85,
        ge=0.0,
        le=1.0
    )


class GovernanceRequest(BaseModel):

    tenant_id: str

    features: Dict[str, float]

    prediction: PredictionInput

    fairness: FairnessInput

    policies: Dict[str, float]

    auto_approve: AutoApproveConfig