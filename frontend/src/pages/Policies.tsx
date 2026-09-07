import {
  Plus,
  Search,
  ShieldCheck,
  AlertTriangle,
  Pencil,
  Trash2,
  CheckCircle2,
} from "lucide-react";

const policies = [
  {
    id: "POL-001",
    name: "Minimum Credit Score",
    field: "credit_score",
    operator: ">=",
    value: "650",
    action: "REJECT",
    severity: "HIGH",
    enabled: true,
    description:
      "Applications below the minimum credit score should not be automatically approved.",
  },
  {
    id: "POL-002",
    name: "Maximum Debt-to-Income Ratio",
    field: "debt_to_income",
    operator: "<=",
    value: "0.40",
    action: "REVIEW",
    severity: "MEDIUM",
    enabled: true,
    description:
      "Applications with a high debt-to-income ratio require additional review.",
  },
  {
    id: "POL-003",
    name: "Minimum Employment Duration",
    field: "employment_years",
    operator: ">=",
    value: "2",
    action: "REVIEW",
    severity: "MEDIUM",
    enabled: true,
    description:
      "Applicant should have at least two years of employment history.",
  },
  {
    id: "POL-004",
    name: "Maximum Loan Amount",
    field: "loan_amount",
    operator: "<=",
    value: "1000000",
    action: "REJECT",
    severity: "HIGH",
    enabled: false,
    description:
      "Loans above the configured maximum require rejection or manual processing.",
  },
];

export default function Policies() {
  const enabledPolicies = policies.filter(
    (policy) => policy.enabled
  ).length;

  const highSeverity = policies.filter(
    (policy) => policy.severity === "HIGH"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-blue-600">
            Governance
          </p>

          <h1 className="text-2xl font-bold text-slate-800">
            Policies
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage tenant-specific AI governance and decision policies.
          </p>
        </div>

        <button className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700">
          <Plus size={18} />
          Add Policy
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Total Policies
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-800">
                {policies.length}
              </p>
            </div>

            <div className="rounded-lg bg-blue-100 p-3 text-blue-600">
              <ShieldCheck size={22} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Enabled Policies
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-800">
                {enabledPolicies}
              </p>
            </div>

            <div className="rounded-lg bg-green-100 p-3 text-green-600">
              <CheckCircle2 size={22} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                High Severity
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-800">
                {highSeverity}
              </p>
            </div>

            <div className="rounded-lg bg-red-100 p-3 text-red-600">
              <AlertTriangle size={22} />
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="relative max-w-md">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="text"
            placeholder="Search policies..."
            className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {/* Policy List */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-6 py-5">
          <h2 className="font-semibold text-slate-800">
            Tenant Policies
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Bank 001 governance rules
          </p>
        </div>

        <div className="divide-y">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className="p-6 transition hover:bg-slate-50"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                {/* Policy information */}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-semibold text-slate-800">
                      {policy.name}
                    </h3>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                      {policy.id}
                    </span>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        policy.enabled
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {policy.enabled ? "ENABLED" : "DISABLED"}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-500">
                    {policy.description}
                  </p>

                  {/* Rule */}
                  <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 font-mono text-sm text-white">
                    <span>{policy.field}</span>
                    <span className="text-blue-300">
                      {policy.operator}
                    </span>
                    <span>{policy.value}</span>
                  </div>
                </div>

                {/* Details */}
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <p className="text-xs text-slate-400">
                      ACTION
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {policy.action}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400">
                      SEVERITY
                    </p>

                    <span
                      className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                        policy.severity === "HIGH"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {policy.severity}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button className="rounded-lg border p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
                      <Pencil size={17} />
                    </button>

                    <button className="rounded-lg border p-2 text-red-500 transition hover:bg-red-50">
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}