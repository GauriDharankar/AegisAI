from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PolicyWriteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    enabled: bool = True
    field: str = Field(..., min_length=1, max_length=120)
    operator: Literal[">", ">=", "<", "<=", "==", "!="]
    value: int | float | str | bool
    action: Literal["APPROVE", "REJECT", "REVIEW", "FLAG"] = "REVIEW"
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = "MEDIUM"

    @field_validator("name", "field")
    @classmethod
    def trim_required_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field cannot be blank.")
        return cleaned

    @field_validator("description")
    @classmethod
    def trim_description(cls, value: str | None) -> str | None:
        cleaned = value.strip() if value is not None else None
        return cleaned or None
