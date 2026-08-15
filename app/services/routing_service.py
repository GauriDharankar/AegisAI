class RoutingService:
    """
    Determines the final governance route for a loan decision.
    """

    def route_decision(
        self,
        prediction: dict,
        fairness_result: dict,
        policy_result: dict,
        configuration: dict
    ):
        """
        Route a loan application to:

        - AUTO_APPROVE
        - HUMAN_REVIEW
        - REJECT
        """

        # =========================================================
        # Extract configuration
        # =========================================================

        auto_approve_enabled = configuration.get(
            "auto_approve_enabled",
            False
        )

        minimum_probability = configuration.get(
            "auto_approve_probability",
            0.85
        )

        # =========================================================
        # 1. Governance errors → Human Review
        # =========================================================

        if policy_result.get("status") == "error":

            return self._result(
                route="HUMAN_REVIEW",
                reason="Policy evaluation could not be completed."
            )

        if fairness_result.get("status") == "insufficient_data":

            return self._result(
                route="HUMAN_REVIEW",
                reason="Insufficient data for fairness analysis."
            )

        # =========================================================
        # 2. Policy violation → Reject
        # =========================================================

        if not policy_result.get("passed", False):

            return self._result(
                route="REJECT",
                reason="One or more lending policies were violated."
            )

        # =========================================================
        # 3. Fairness violation → Human Review
        # =========================================================

        if not fairness_result.get("passed", False):

            return self._result(
                route="HUMAN_REVIEW",
                reason="Fairness policy violation detected."
            )

        # =========================================================
        # 4. ML model rejection → Reject
        # =========================================================

        if prediction.get("label") == "reject":

            return self._result(
                route="REJECT",
                reason="The underlying ML model predicted rejection."
            )

        # =========================================================
        # 5. Auto-approval check
        # =========================================================

        probability = prediction.get(
            "probability",
            0.0
        )

        if auto_approve_enabled:

            if probability >= minimum_probability:

                return self._result(
                    route="AUTO_APPROVE",
                    reason=(
                        "All governance checks passed and "
                        "the model confidence meets the "
                        "tenant's auto-approval threshold."
                    )
                )

        # =========================================================
        # 6. Default → Human Review
        # =========================================================

        return self._result(
            route="HUMAN_REVIEW",
            reason=(
                "The application passed governance checks "
                "but does not meet the conditions for "
                "automatic approval."
            )
        )

    # =============================================================
    # Helper
    # =============================================================

    @staticmethod
    def _result(
        route: str,
        reason: str
    ):
        return {
            "route": route,
            "reason": reason
        }