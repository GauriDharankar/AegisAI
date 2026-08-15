class PolicyService:
    """
    Evaluates applicant data against tenant-defined lending policies.
    """

    def check_compliance(
        self,
        features: dict,
        policies: dict
    ):
        checks = []
        violations = []
        errors = []

        # =========================================================
        # 1. Minimum Credit Score
        # =========================================================

        if "minimum_credit_score" in policies:

            required = policies["minimum_credit_score"]
            actual = features.get("credit_score")

            if actual is None:
                check = {
                    "rule": "minimum_credit_score",
                    "actual": None,
                    "required": required,
                    "status": "error",
                    "message": "Credit score is missing."
                }

                checks.append(check)
                errors.append(check)

            else:
                passed = actual >= required

                check = {
                    "rule": "minimum_credit_score",
                    "actual": actual,
                    "required": required,
                    "status": "pass" if passed else "fail"
                }

                checks.append(check)

                if not passed:
                    violations.append(check)

        # =========================================================
        # 2. Minimum Income
        # =========================================================

        if "minimum_income" in policies:

            required = policies["minimum_income"]
            actual = features.get("income")

            if actual is None:
                check = {
                    "rule": "minimum_income",
                    "actual": None,
                    "required": required,
                    "status": "error",
                    "message": "Income is missing."
                }

                checks.append(check)
                errors.append(check)

            else:
                passed = actual >= required

                check = {
                    "rule": "minimum_income",
                    "actual": actual,
                    "required": required,
                    "status": "pass" if passed else "fail"
                }

                checks.append(check)

                if not passed:
                    violations.append(check)

        # =========================================================
        # 3. Maximum Debt-to-Income Ratio
        # =========================================================

        if "maximum_debt_to_income" in policies:

            maximum = policies["maximum_debt_to_income"]
            actual = features.get("debt_to_income")

            if actual is None:
                check = {
                    "rule": "maximum_debt_to_income",
                    "actual": None,
                    "maximum": maximum,
                    "status": "error",
                    "message": "Debt-to-income ratio is missing."
                }

                checks.append(check)
                errors.append(check)

            else:
                passed = actual <= maximum

                check = {
                    "rule": "maximum_debt_to_income",
                    "actual": actual,
                    "maximum": maximum,
                    "status": "pass" if passed else "fail"
                }

                checks.append(check)

                if not passed:
                    violations.append(check)

        # =========================================================
        # 4. Maximum Loan Amount
        # =========================================================

        if "maximum_loan_amount" in policies:

            maximum = policies["maximum_loan_amount"]
            actual = features.get("loan_amount")

            if actual is None:
                check = {
                    "rule": "maximum_loan_amount",
                    "actual": None,
                    "maximum": maximum,
                    "status": "error",
                    "message": "Loan amount is missing."
                }

                checks.append(check)
                errors.append(check)

            else:
                passed = actual <= maximum

                check = {
                    "rule": "maximum_loan_amount",
                    "actual": actual,
                    "maximum": maximum,
                    "status": "pass" if passed else "fail"
                }

                checks.append(check)

                if not passed:
                    violations.append(check)

        # =========================================================
        # Final Compliance Result
        # =========================================================

        if errors:
            status = "error"
            passed = False

        elif violations:
            status = "violation"
            passed = False

        else:
            status = "compliant"
            passed = True

        return {
            "status": status,
            "passed": passed,
            "total_checks": len(checks),
            "passed_checks": sum(
                1 for check in checks
                if check["status"] == "pass"
            ),
            "failed_checks": sum(
                1 for check in checks
                if check["status"] == "fail"
            ),
            "checks": checks,
            "violations": violations,
            "errors": errors
        }