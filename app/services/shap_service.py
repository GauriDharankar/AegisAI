import shap
import pandas as pd

from app.services.model_service import FEATURES


class SHAPService:

    def __init__(self, model):

        self.model = model

        # -----------------------------------------------------
        # SHAP LinearExplainer is appropriate for a linear model.
        # -----------------------------------------------------

        background_data = pd.DataFrame(
            [
                [50000, 650, 300000, 0.35, 5],
                [75000, 750, 250000, 0.25, 8],
                [30000, 600, 400000, 0.50, 2],
                [100000, 800, 200000, 0.20, 10]
            ],
            columns=FEATURES
        )

        self.explainer = shap.Explainer(
            self.model.predict_proba,
            background_data
        )

    def explain(self, features: dict):

        input_data = pd.DataFrame(
            [[features[feature] for feature in FEATURES]],
            columns=FEATURES
        )

        shap_values = self.explainer(input_data)

        # -----------------------------------------------------
        # We explain the probability of approval (class 1).
        # -----------------------------------------------------

        values = shap_values.values

        if values.ndim == 3:
            values = values[0, :, 1]

        else:
            values = values[0]

        explanation = {}

        for feature, value in zip(
            FEATURES,
            values
        ):
            explanation[feature] = float(value)

        # -----------------------------------------------------
        # Sort by absolute impact.
        # -----------------------------------------------------

        sorted_features = sorted(
            explanation.items(),
            key=lambda item: abs(item[1]),
            reverse=True
        )

        top_features = [
            {
                "feature": feature,
                "impact": round(value, 6),
                "direction": (
                    "positive"
                    if value > 0
                    else "negative"
                )
            }
            for feature, value in sorted_features
        ]

        return {
            "method": "SHAP",
            "features": explanation,
            "top_features": top_features
        }