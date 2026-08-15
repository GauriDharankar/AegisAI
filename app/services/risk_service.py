class RiskService:

    def calculate_risk(
        self,
        prediction: dict,
        fairness_result: dict,
        policy_result: dict
    ):

        if policy_result.get("status") == "violation":
            return "HIGH"

        if policy_result.get("status") == "error":
            return "HIGH"

        if fairness_result.get("status") == "violation":
            return "HIGH"

        if prediction.get("label") == "reject":
            return "HIGH"

        probability = prediction.get(
            "probability",
            0.0
        )

        if probability >= 0.85:
            return "LOW"

        if probability >= 0.65:
            return "MEDIUM"

        return "HIGH"