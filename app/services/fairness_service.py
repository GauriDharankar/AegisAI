import pandas as pd


class FairnessService:

    def demographic_parity(
        self,
        predictions: list[int],
        protected_groups: list[str],
        threshold: float = 0.10
    ):
        """
        Calculate demographic parity across protected groups.

        Demographic parity compares the positive prediction
        rate between different groups.
        """

        if len(predictions) != len(protected_groups):
            raise ValueError(
                "Predictions and protected_groups must have the same length."
            )

        if len(predictions) == 0:
            raise ValueError(
                "Predictions cannot be empty."
            )

        data = pd.DataFrame({
            "prediction": predictions,
            "group": protected_groups
        })

        approval_rates = (
            data.groupby("group")["prediction"]
            .mean()
            .to_dict()
        )

        groups = list(approval_rates.keys())

        if len(groups) < 2:
            return {
                "status": "insufficient_data",
                "metric": "demographic_parity",
                "message": "At least two protected groups are required.",
                "approval_rates": approval_rates
            }

        max_rate = max(approval_rates.values())
        min_rate = min(approval_rates.values())

        difference = abs(max_rate - min_rate)

        passed = difference <= threshold

        return {
            "status": "pass" if passed else "violation",
            "metric": "demographic_parity",
            "approval_rates": {
                group: round(rate, 4)
                for group, rate in approval_rates.items()
            },
            "difference": round(difference, 4),
            "threshold": threshold,
            "passed": passed
        }