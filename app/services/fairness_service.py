import pandas as pd


class FairnessService:

    def demographic_parity(
        self,
        predictions: list[int],
        protected_groups: list[str],
        threshold: float = 0.10,
        minimum_group_size: int = 1
    ):

        # =====================================================
        # VALIDATION
        # =====================================================

        if len(predictions) != len(protected_groups):

            raise ValueError(
                "Predictions and protected_groups "
                "must have the same length."
            )

        if len(predictions) == 0:

            return {
                "status": "insufficient_data",
                "metric": "demographic_parity",
                "message": (
                    "No fairness data was provided."
                ),
                "approval_rates": {}
            }

        # =====================================================
        # BUILD DATASET
        # =====================================================

        data = pd.DataFrame({
            "prediction": predictions,
            "group": protected_groups
        })

        # =====================================================
        # GROUP SIZES
        # =====================================================

        group_sizes = (
            data.groupby("group")
            .size()
            .to_dict()
        )

        insufficient_groups = {
            group: size
            for group, size in group_sizes.items()
            if size < minimum_group_size
        }

        if insufficient_groups:

            return {
                "status": "insufficient_data",
                "metric": "demographic_parity",
                "message": (
                    "One or more protected groups "
                    "do not have sufficient data."
                ),
                "group_sizes": group_sizes,
                "minimum_group_size": minimum_group_size,
                "insufficient_groups": insufficient_groups
            }

        # =====================================================
        # APPROVAL RATES
        # =====================================================

        approval_rates = (
            data.groupby("group")["prediction"]
            .mean()
            .to_dict()
        )

        groups = list(
            approval_rates.keys()
        )

        if len(groups) < 2:

            return {
                "status": "insufficient_data",
                "metric": "demographic_parity",
                "message": (
                    "At least two protected groups "
                    "are required."
                ),
                "approval_rates": approval_rates
            }

        # =====================================================
        # DEMOGRAPHIC PARITY
        # =====================================================

        max_rate = max(
            approval_rates.values()
        )

        min_rate = min(
            approval_rates.values()
        )

        difference = abs(
            max_rate - min_rate
        )

        passed = difference <= threshold

        # =====================================================
        # RESULT
        # =====================================================

        return {

            "status": (
                "pass"
                if passed
                else "violation"
            ),

            "metric": "demographic_parity",

            "approval_rates": {
                group: round(rate, 4)
                for group, rate
                in approval_rates.items()
            },

            "group_sizes": group_sizes,

            "difference": round(
                difference,
                4
            ),

            "threshold": threshold,

            "passed": passed,

            "message": (
                "Approval-rate difference is within "
                "the configured fairness threshold."
                if passed
                else
                "Approval-rate difference exceeds "
                "the configured fairness threshold."
            )
        }