import numpy as np
import pandas as pd

from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline


FEATURES = [
    "income",
    "credit_score",
    "loan_amount",
    "debt_to_income",
    "employment_years"
]


class LoanModel:

    def __init__(self):
        self.model = self._train_model()

    def _train_model(self):

        rng = np.random.RandomState(42)

        n_samples = 3000

        income = rng.randint(15000, 150000, n_samples)
        credit_score = rng.randint(300, 850, n_samples)
        loan_amount = rng.randint(50000, 1000000, n_samples)
        debt_to_income = rng.uniform(0.05, 0.80, n_samples)
        employment_years = rng.randint(0, 30, n_samples)

        data = pd.DataFrame({
            "income": income,
            "credit_score": credit_score,
            "loan_amount": loan_amount,
            "debt_to_income": debt_to_income,
            "employment_years": employment_years
        })

        # -----------------------------------------------------
        # Synthetic lending score
        #
        # Positive:
        #   credit score
        #   income
        #   employment years
        #
        # Negative:
        #   debt-to-income
        #   loan amount
        # -----------------------------------------------------

        score = (
            0.45 * (credit_score / 850)
            + 0.30 * np.clip(income / 100000, 0, 1)
            + 0.15 * np.clip(employment_years / 20, 0, 1)
            - 0.35 * debt_to_income
            - 0.20 * np.clip(loan_amount / 1000000, 0, 1)
        )

        score += rng.normal(
            0,
            0.02,
            n_samples
        )

        target = (score >= 0.40).astype(int)

        model = Pipeline([
            (
                "scaler",
                StandardScaler()
            ),
            (
                "classifier",
                LogisticRegression(
                    random_state=42,
                    max_iter=1000
                )
            )
        ])

        model.fit(
            data[FEATURES],
            target
        )

        return model

    def predict(self, features: dict):

        input_data = pd.DataFrame(
            [[features[feature] for feature in FEATURES]],
            columns=FEATURES
        )

        prediction = int(
            self.model.predict(input_data)[0]
        )

        probability = float(
            self.model.predict_proba(input_data)[0][1]
        )

        return {
            "prediction": prediction,
            "label": (
                "approve"
                if prediction == 1
                else "reject"
            ),
            "probability": probability
        }

    def get_model(self):
        return self.model


loan_model = LoanModel()