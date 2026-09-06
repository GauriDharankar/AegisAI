from typing import Any


class PolicyService:
    """
    Generic configurable policy evaluation engine.

    Policies are supplied by the tenant and can originate from:
    - Manual configuration
    - Database
    - NLP-extracted bank policy documents
    """

    SUPPORTED_OPERATORS = {
        ">",
        ">=",
        "<",
        "<=",
        "==",
        "!="
    }

    def check_compliance(
        self,
        features: dict,
        policies: list
    ):

        checks = []
        violations = []
        errors = []
        flags = []

        for policy in policies:

            # -------------------------------------------------
            # Convert Pydantic model to dictionary if necessary
            # -------------------------------------------------

            if hasattr(policy, "model_dump"):
                policy = policy.model_dump()

            # -------------------------------------------------
            # Ignore disabled policies
            # -------------------------------------------------

            if not policy.get("enabled", True):
                continue

            policy_id = policy.get(
                "policy_id",
                "UNKNOWN"
            )

            name = policy.get(
                "name",
                policy_id
            )

            field = policy.get("field")

            operator = policy.get("operator")

            expected = policy.get("value")

            action = policy.get(
                "action",
                "REVIEW"
            )

            severity = policy.get(
                "severity",
                "MEDIUM"
            )

            # -------------------------------------------------
            # Validate policy definition
            # -------------------------------------------------

            if not field:

                error = {
                    "policy_id": policy_id,
                    "policy": name,
                    "status": "error",
                    "message": "Policy field is missing."
                }

                checks.append(error)
                errors.append(error)
                continue

            if operator not in self.SUPPORTED_OPERATORS:

                error = {
                    "policy_id": policy_id,
                    "policy": name,
                    "status": "error",
                    "message": (
                        f"Unsupported operator: {operator}"
                    )
                }

                checks.append(error)
                errors.append(error)
                continue

            # -------------------------------------------------
            # Get applicant value
            # -------------------------------------------------

            actual = features.get(field)

            if actual is None:

                error = {
                    "policy_id": policy_id,
                    "policy": name,
                    "field": field,
                    "status": "error",
                    "message": (
                        f"Required field '{field}' is missing."
                    )
                }

                checks.append(error)
                errors.append(error)
                continue

            # -------------------------------------------------
            # Evaluate rule
            # -------------------------------------------------

            try:

                passed = self._evaluate_condition(
                    actual,
                    operator,
                    expected
                )

            except Exception as exc:

                error = {
                    "policy_id": policy_id,
                    "policy": name,
                    "field": field,
                    "actual": actual,
                    "expected": expected,
                    "status": "error",
                    "message": str(exc)
                }

                checks.append(error)
                errors.append(error)
                continue

            # -------------------------------------------------
            # Create result
            # -------------------------------------------------

            check = {
                "policy_id": policy_id,
                "policy": name,
                "field": field,
                "operator": operator,
                "actual": actual,
                "expected": expected,
                "action": action,
                "severity": severity,
                "status": "pass" if passed else "fail"
            }

            checks.append(check)

            # -------------------------------------------------
            # Policy failed
            # -------------------------------------------------

            if not passed:

                violations.append(check)

                if action == "FLAG":
                    flags.append(check)

        # =====================================================
        # FINAL RESULT
        # =====================================================

        if errors:

            status = "error"
            passed = False

        else:

            blocking_violations = [
                violation
                for violation in violations
                if violation.get("action") in {"REJECT", "REVIEW"}
            ]

            if blocking_violations:

                status = "violation"
                passed = False

            elif violations:

                status = "flagged"
                passed = True

            else:

                status = "compliant"
                passed = True

        return {

            "status": status,

            "passed": passed,

            "total_checks": len(checks),

            "passed_checks": sum(
                1
                for check in checks
                if check["status"] == "pass"
            ),

            "failed_checks": sum(
                1
                for check in checks
                if check["status"] == "fail"
            ),

            "checks": checks,

            "violations": violations,

            "flags": flags,

            "errors": errors
        }

    # =========================================================
    # CONDITION EVALUATOR
    # =========================================================

    @staticmethod
    def _evaluate_condition(
        actual: Any,
        operator: str,
        expected: Any
    ) -> bool:

        if operator == ">":
            return actual > expected

        if operator == ">=":
            return actual >= expected

        if operator == "<":
            return actual < expected

        if operator == "<=":
            return actual <= expected

        if operator == "==":
            return actual == expected

        if operator == "!=":
            return actual != expected

        raise ValueError(
            f"Unsupported operator: {operator}"
        )