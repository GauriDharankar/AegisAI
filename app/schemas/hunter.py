from pydantic import BaseModel, Field
from typing import Optional


class HunterApplicationRequest(BaseModel):
    tenant_id: str = Field(
        ...,
        description="Bank/tenant submitting the application"
    )

    applicant_id: str = Field(
        ...,
        description="Unique applicant identifier"
    )

    loan_type: str = Field(
        ...,
        description="Type of loan"
    )

    loan_amount: float = Field(
        ...,
        gt=0,
        description="Requested loan amount"
    )

    application_id: Optional[str] = Field(
        default=None,
        description="Application ID"
    )


class HunterResponse(BaseModel):
    flagged: bool
    flag_type: Optional[str]
    severity: str
    message: str
    application: dict
    alert: Optional[dict]
    action: str