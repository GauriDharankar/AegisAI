def calculate_debt_to_income(existing_monthly_emi: float, monthly_income: float) -> float:
    """Return DTI as monthly EMI divided by monthly income."""
    if monthly_income <= 0:
        return 0.0
    return existing_monthly_emi / monthly_income
