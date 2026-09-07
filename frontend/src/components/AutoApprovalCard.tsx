interface Props {
  enabled: boolean;
  eligible: boolean;
  minimumProbability: number;
  maximumRisk: string;
  requirePolicyCompliance: boolean;
  requireFairnessPass: boolean;
  reasons: string[];
}

export default function AutoApprovalCard({
  enabled,
  eligible,
  minimumProbability,
  maximumRisk,
  requirePolicyCompliance,
  requireFairnessPass,
  reasons,
}: Props) {
  return (
    <div className="rounded-xl border bg-white p-6">
      <h2 className="text-lg font-semibold">
        Auto-Approval Eligibility
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Tenant-configured automatic approval rules
      </p>

      <div className="mt-5 flex items-center gap-3">
        <span
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            eligible
              ? "bg-green-100 text-green-700"
              : "bg-yellow-100 text-yellow-700"
          }`}
        >
          {eligible
            ? "AUTO-APPROVAL ELIGIBLE"
            : "HUMAN REVIEW REQUIRED"}
        </span>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs text-slate-500">
            Auto Approval
          </p>

          <p className="mt-1 font-semibold">
            {enabled ? "ENABLED" : "DISABLED"}
          </p>
        </div>

        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs text-slate-500">
            Minimum Probability
          </p>

          <p className="mt-1 font-semibold">
            {(minimumProbability * 100).toFixed(0)}%
          </p>
        </div>

        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs text-slate-500">
            Maximum Risk
          </p>

          <p className="mt-1 font-semibold">
            {maximumRisk}
          </p>
        </div>

        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs text-slate-500">
            Policy Compliance
          </p>

          <p className="mt-1 font-semibold">
            {requirePolicyCompliance
              ? "Required"
              : "Not Required"}
          </p>
        </div>
      </div>

      {reasons.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-sm font-medium">
            Eligibility factors
          </p>

          {reasons.map((reason, index) => (
            <p
              key={index}
              className="mb-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600"
            >
              {reason}
            </p>
          ))}
        </div>
      )}

      <div className="mt-4 text-xs text-slate-500">
        Fairness requirement:{" "}
        {requireFairnessPass ? "Required" : "Not Required"}
      </div>
    </div>
  );
}