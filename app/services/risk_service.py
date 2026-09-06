class RiskService:
    """
    Calculates governance risk using:
    - ML confidence
    - Policy compliance
    - Fairness analysis

    Risk thresholds are tenant-configurable.
    """

    def calculate_risk(
        self,
        prediction: dict,
        fairness_result: dict,
        policy_result: dict,
        low_probability: float = 0.85,
        medium_probability: float = 0.65
    ):

        # =====================================================
        # GOVERNANCE FAILURES
        # =====================================================

        if policy_result.get("status") in {
            "violation",
            "error"
        }:

            return "HIGH"

        if fairness_result.get(
            "status"
        ) == "violation":

            return "HIGH"

        if fairness_result.get(
            "status"
        ) == "insufficient_data":

            return "HIGH"

        # =====================================================
        # MODEL REJECTION
        # =====================================================

        if prediction.get("label") == "reject":

            return "HIGH"

        # =====================================================
        # MODEL CONFIDENCE
        # =====================================================

        probability = prediction.get(
            "probability",
            0.0
        )

        if probability >= low_probability:
            return "LOW"

        if probability >= medium_probability:
            return "MEDIUM"

        return "HIGH"