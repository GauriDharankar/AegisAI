import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import GovernanceTrace from "../components/GovernanceTrace";
import ShapChart from "../components/ShapChart";
import FairnessCard from "../components/FairnessCard";
import PolicyTable from "../components/PolicyTable";
import RiskCard from "../components/RiskCard";
import AutoApprovalCard from "../components/AutoApprovalCard";

import { applications } from "../data/mockData";

export default function GovernanceAnalysis() {
  const { id } = useParams();
  const navigate = useNavigate();

  const application = applications.find(
    (item) => item.id === id
  );

  if (!application) {
    return (
      <div className="rounded-xl border bg-white p-8">
        Application not found.
      </div>
    );
  }

  const trace = [
    {
      stage: "MODEL",
      status: "PASS" as const,
      title: `Prediction: ${application.aiDecision}`,
      description: `Model probability: ${(
        application.probability * 100
      ).toFixed(0)}%`,
    },
    {
      stage: "SHAP",
      status: "PASS" as const,
      title: "Explanation generated",
      description:
        "Top contributing model features identified.",
    },
    {
      stage: "FAIRNESS",
      status: "PASS" as const,
      title: "Fairness analysis passed",
      description:
        "Demographic parity is within the configured threshold.",
    },
    {
      stage: "POLICY",
      status: "PASS" as const,
      title: "Policy compliance checked",
      description:
        "Tenant-configured policies evaluated.",
    },
    {
      stage: "RISK",
      status: "WARNING" as const,
      title: `Risk: ${application.riskLevel}`,
      description:
        "Risk calculated using governance factors.",
    },
    {
      stage: "ROUTING",
      status: "WARNING" as const,
      title: "Human Review",
      description:
        "Decision routed for human intervention.",
    },
    {
      stage: "FINAL",
      status: "WARNING" as const,
      title: "Final Decision: HUMAN REVIEW",
      description:
        "Awaiting reviewer decision.",
    },
  ];

  const shapFeatures = [
    {
      feature: "Credit Score",
      contribution: 0.31,
      displayValue: String(application.creditScore),
    },
    {
      feature: "Annual Income",
      contribution: 0.22,
      displayValue: `₹${application.income.toLocaleString()}`,
    },
    {
      feature: "Employment Years",
      contribution: 0.14,
      displayValue: "8",
    },
    {
      feature: "Debt-to-Income",
      contribution: -0.06,
      displayValue: "0.25",
    },
    {
      feature: "Loan Amount",
      contribution: -0.04,
      displayValue: `₹${application.amount.toLocaleString()}`,
    },
  ];

  const policies = [
    {
      policyId: "POL-001",
      name: "Minimum Credit Score",
      field: "credit_score",
      operator: ">=",
      requiredValue: 650,
      actualValue: application.creditScore,
      action: "REJECT",
      severity: "HIGH",
      passed: application.creditScore >= 650,
    },
    {
      policyId: "POL-002",
      name: "Maximum DTI",
      field: "debt_to_income",
      operator: "<=",
      requiredValue: 0.4,
      actualValue: 0.25,
      action: "REVIEW",
      severity: "MEDIUM",
      passed: true,
    },
    {
      policyId: "POL-003",
      name: "Minimum Employment",
      field: "employment_years",
      operator: ">=",
      requiredValue: 2,
      actualValue: 8,
      action: "REVIEW",
      severity: "LOW",
      passed: true,
    },
  ];

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/reviews")}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={18} />
        Back to Decision Queue
      </button>

      {/* Header */}
      <div className="rounded-xl border bg-white p-6">
        <div className="flex flex-col justify-between gap-5 md:flex-row">
          <div>
            <p className="text-sm text-slate-500">
              Application
            </p>

            <h1 className="text-2xl font-bold">
              {application.id}
            </h1>

            <p className="mt-1 text-slate-500">
              {application.applicantName}
            </p>
          </div>

          <div className="text-left md:text-right">
            <p className="text-sm text-slate-500">
              Final Decision
            </p>

            <p className="mt-1 text-2xl font-bold text-yellow-600">
              HUMAN REVIEW
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs text-slate-500">
              AI Prediction
            </p>

            <p className="mt-1 font-semibold">
              {application.aiDecision}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs text-slate-500">
              Confidence
            </p>

            <p className="mt-1 font-semibold">
              {(application.probability * 100).toFixed(0)}%
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs text-slate-500">
              Risk
            </p>

            <p className="mt-1 font-semibold">
              {application.riskLevel}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs text-slate-500">
              Reason
            </p>

            <p className="mt-1 font-semibold">
              Low Confidence
            </p>
          </div>
        </div>
      </div>

      {/* Governance Trace */}
      <GovernanceTrace trace={trace} />

      {/* SHAP + Fairness */}
      <div className="grid gap-6 xl:grid-cols-2">
        <ShapChart features={shapFeatures} />

        <FairnessCard
          enabled={true}
          metric="Demographic Parity"
          threshold={0.10}
          disparity={0.042}
          minimumGroupSize={2}
          passed={true}
          groups={[
            {
              group: "Group A",
              approvalRate: 0.962,
              sampleSize: 50,
            },
            {
              group: "Group B",
              approvalRate: 0.920,
              sampleSize: 48,
            },
          ]}
        />
      </div>

      {/* Policies */}
      <PolicyTable policies={policies} />

      {/* Risk + Auto Approval */}
      <div className="grid gap-6 xl:grid-cols-2">
        <RiskCard
          level={application.riskLevel}
          reasons={[
            "Confidence is below the configured auto-approval threshold.",
          ]}
        />

        <AutoApprovalCard
          enabled={true}
          eligible={false}
          minimumProbability={0.85}
          maximumRisk="LOW"
          requirePolicyCompliance={true}
          requireFairnessPass={true}
          reasons={[
            "Confidence requirement not met.",
            "Application requires human review.",
          ]}
        />
      </div>
    </div>
  );
}