class RoutingService:
    """
    Determines the final governance route for a lending decision.

    Routing priority:
    1. Policy evaluation errors
    2. Critical policy violations
    3. Explicit REJECT policy violations
    4. Explicit REVIEW policy violations
    5. Fairness issues
    6. Model rejection
    7. Auto-approval eligibility
    8. Human review

    Policy actions:
    - REJECT -> Reject the decision
    - REVIEW -> Send to human review
    - FLAG -> Continue the decision, but attach a governance flag
    - APPROVE -> Positive policy signal; continue remaining governance checks
    """

    POLICY_PRIORITY = {
        "CRITICAL": 4,
        "HIGH": 3,
        "MEDIUM": 2,
        "LOW": 1
    }

    def route_decision(
        self,
        prediction,
        fairness_result,
        policy_result,
        risk_level,
        configuration
    ):
        """
        Determine the final route based on governance results.
        """

        # ---------------------------------------------------------
        # 1. POLICY EVALUATION ERROR
        # ---------------------------------------------------------
        if policy_result.get("status") == "error":
            return {
                "route": "HUMAN_REVIEW",
                "reason_code": "POLICY_EVALUATION_ERROR",
                "reason": "Policy evaluation could not be completed safely.",
                "flags": []
            }

        # ---------------------------------------------------------
        # 2. COLLECT POLICY RESULTS
        # ---------------------------------------------------------
        violations = policy_result.get("violations", [])

        critical_violations = [
            violation
            for violation in violations
            if violation.get("severity") == "CRITICAL"
        ]

        reject_violations = [
            violation
            for violation in violations
            if violation.get("action") == "REJECT"
        ]

        review_violations = [
            violation
            for violation in violations
            if violation.get("action") == "REVIEW"
        ]

        flag_violations = [
            violation
            for violation in violations
            if violation.get("action") == "FLAG"
        ]

        # ---------------------------------------------------------
        # 3. FORMAT NON-BLOCKING FLAGS
        # ---------------------------------------------------------
        flags = [
            {
                "policy_id": violation.get("policy_id"),
                "policy": violation.get("policy", "Unknown policy"),
                "severity": violation.get("severity", "LOW")
            }
            for violation in flag_violations
        ]

        # ---------------------------------------------------------
        # 4. CRITICAL POLICY VIOLATION
        # ---------------------------------------------------------
        if critical_violations:
            violation = critical_violations[0]

            return {
                "route": "REJECT",
                "reason_code": "CRITICAL_POLICY_VIOLATION",
                "reason": (
                    f"Critical policy violation: "
                    f"{violation.get('policy', 'Unknown policy')}"
                ),
                "flags": flags
            }

        # ---------------------------------------------------------
        # 5. EXPLICIT REJECT POLICY
        # ---------------------------------------------------------
        if reject_violations:
            violation = reject_violations[0]

            return {
                "route": "REJECT",
                "reason_code": "POLICY_VIOLATION",
                "reason": (
                    f"Policy violation: "
                    f"{violation.get('policy', 'Unknown policy')}"
                ),
                "flags": flags
            }

        # ---------------------------------------------------------
        # 6. EXPLICIT REVIEW POLICY
        # ---------------------------------------------------------
        if review_violations:
            violation = review_violations[0]

            return {
                "route": "HUMAN_REVIEW",
                "reason_code": "POLICY_REVIEW_REQUIRED",
                "reason": (
                    f"Manual review required by policy: "
                    f"{violation.get('policy', 'Unknown policy')}"
                ),
                "flags": flags
            }

        # ---------------------------------------------------------
        # 7. FAIRNESS CHECK
        # ---------------------------------------------------------
        fairness_status = fairness_result.get("status")

        if fairness_status == "insufficient_data":
            return {
                "route": "HUMAN_REVIEW",
                "reason_code": "INSUFFICIENT_FAIRNESS_DATA",
                "reason": (
                    "There is insufficient data to complete "
                    "the fairness evaluation."
                ),
                "flags": flags
            }

        if fairness_status == "violation":
            return {
                "route": "HUMAN_REVIEW",
                "reason_code": "FAIRNESS_VIOLATION",
                "reason": (
                    "The configured fairness threshold "
                    "was exceeded."
                ),
                "flags": flags
            }

        # ---------------------------------------------------------
        # 8. MODEL REJECTION
        # ---------------------------------------------------------
        prediction_label = prediction.get("label", "").lower()

        if prediction_label == "reject":
            return {
                "route": "REJECT",
                "reason_code": "MODEL_REJECTION",
                "reason": "The AI model predicted rejection.",
                "flags": flags
            }

        # ---------------------------------------------------------
        # 9. AUTO-APPROVAL CONFIGURATION
        # ---------------------------------------------------------
        auto_config = configuration.get("auto_approve", {})

        auto_enabled = auto_config.get("enabled", False)

        probability = prediction.get("probability", 0.0)

        minimum_probability = auto_config.get(
            "minimum_probability",
            0.85
        )

        maximum_risk = auto_config.get(
            "maximum_risk",
            "LOW"
        )

        require_policy_compliance = auto_config.get(
            "require_policy_compliance",
            True
        )

        require_fairness_pass = auto_config.get(
            "require_fairness_pass",
            True
        )

        # ---------------------------------------------------------
        # 10. CHECK AUTO-APPROVAL ELIGIBILITY
        # ---------------------------------------------------------
        if auto_enabled:

            probability_ok = probability >= minimum_probability

            risk_order = {
                "LOW": 1,
                "MEDIUM": 2,
                "HIGH": 3
            }

            current_risk_value = risk_order.get(
                risk_level,
                3
            )

            maximum_risk_value = risk_order.get(
                maximum_risk,
                1
            )

            risk_ok = current_risk_value <= maximum_risk_value

            policy_ok = (
                policy_result.get("passed", False)
                if require_policy_compliance
                else True
            )

            fairness_ok = (
                fairness_result.get("passed", False)
                if require_fairness_pass
                else True
            )

            if (
                probability_ok
                and risk_ok
                and policy_ok
                and fairness_ok
            ):
                return {
                    "route": "AUTO_APPROVE",
                    "reason_code": "AUTO_APPROVAL",
                    "reason": (
                        "The decision satisfied all configured "
                        "auto-approval requirements."
                    ),
                    "flags": flags
                }

        # ---------------------------------------------------------
        # 11. LOW CONFIDENCE
        # ---------------------------------------------------------
        if auto_enabled and probability < minimum_probability:
            return {
                "route": "HUMAN_REVIEW",
                "reason_code": "LOW_CONFIDENCE",
                "reason": (
                    f"Prediction probability "
                    f"{probability:.2f} is below the configured "
                    f"auto-approval threshold of "
                    f"{minimum_probability:.2f}."
                ),
                "flags": flags
            }

        # ---------------------------------------------------------
        # 12. AUTO-APPROVAL DISABLED
        # ---------------------------------------------------------
        if not auto_enabled:
            return {
                "route": "HUMAN_REVIEW",
                "reason_code": "AUTO_APPROVAL_DISABLED",
                "reason": (
                    "Automatic approval is disabled "
                    "for this tenant."
                ),
                "flags": flags
            }

        # ---------------------------------------------------------
        # 13. DEFAULT HUMAN REVIEW
        # ---------------------------------------------------------
        return {
            "route": "HUMAN_REVIEW",
            "reason_code": "GOVERNANCE_REVIEW",
            "reason": "The decision requires human governance review.",
            "flags": flags
        }