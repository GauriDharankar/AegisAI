import {
  ShieldCheck,
  AlertTriangle,
  Users,
  Activity,
  CheckCircle2,
} from "lucide-react";

const groups = [
  {
    name: "Group A",
    approvalRate: 96.2,
    applications: 250,
  },
  {
    name: "Group B",
    approvalRate: 92.0,
    applications: 240,
  },
  {
    name: "Group C",
    approvalRate: 94.1,
    applications: 180,
  },
];

const alerts = [
  {
    id: "ALT-001",
    title: "Approval rate disparity detected",
    description:
      "Difference between the highest and lowest group approval rate is approaching the configured threshold.",
    severity: "MEDIUM",
    time: "10 minutes ago",
  },
  {
    id: "ALT-002",
    title: "Override rate increased",
    description:
      "Human reviewer overrides have increased above the monitoring baseline.",
    severity: "LOW",
    time: "1 hour ago",
  },
];

export default function FairnessBias() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm font-medium text-blue-600">
          Governance Monitoring
        </p>

        <h1 className="text-2xl font-bold text-slate-800">
          Fairness & Bias
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Monitor fairness metrics, demographic disparities and
          potential model bias.
        </p>
      </div>

      {/* Overall status */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-green-100 p-4 text-green-600">
              <ShieldCheck size={28} />
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Overall Fairness Status
              </p>

              <h2 className="mt-1 text-xl font-bold text-green-600">
                PASSED
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Current fairness metrics are within configured
                governance thresholds.
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 px-5 py-4">
            <p className="text-xs text-slate-400">
              LAST EVALUATED
            </p>

            <p className="mt-1 font-semibold text-slate-700">
              Today, 10:32 AM
            </p>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Demographic Parity
              </p>

              <p className="mt-2 text-2xl font-bold text-green-600">
                4.2%
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Threshold: 10%
              </p>
            </div>

            <CheckCircle2
              size={24}
              className="text-green-500"
            />
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Protected Groups
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-800">
                3
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Being monitored
              </p>
            </div>

            <Users
              size={24}
              className="text-blue-500"
            />
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Override Rate
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-800">
                12.5%
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Last 30 days
              </p>
            </div>

            <Activity
              size={24}
              className="text-purple-500"
            />
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Bias Alerts
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-800">
                2
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Active alerts
              </p>
            </div>

            <AlertTriangle
              size={24}
              className="text-yellow-500"
            />
          </div>
        </div>
      </div>

      {/* Fairness Configuration */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-800">
            Fairness Configuration
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Current tenant-level fairness monitoring configuration.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs text-slate-500">
              Fairness Analysis
            </p>

            <p className="mt-2 font-semibold text-green-600">
              ENABLED
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs text-slate-500">
              Metric
            </p>

            <p className="mt-2 font-semibold text-slate-800">
              Demographic Parity
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs text-slate-500">
              Threshold
            </p>

            <p className="mt-2 font-semibold text-slate-800">
              10%
            </p>
          </div>
        </div>
      </div>

      {/* Group approval rates */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-800">
            Protected Group Approval Rates
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Comparison of approval rates across monitored groups.
          </p>
        </div>

        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.name}>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-700">
                    {group.name}
                  </p>

                  <p className="text-xs text-slate-400">
                    {group.applications} applications
                  </p>
                </div>

                <p className="font-semibold text-slate-800">
                  {group.approvalRate}%
                </p>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{
                    width: `${group.approvalRate}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-lg bg-green-50 p-4 text-sm text-green-700">
          The current difference between the highest and lowest
          group approval rates is within the configured fairness
          threshold.
        </div>
      </div>

      {/* Bias Alerts */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-6 py-5">
          <h2 className="font-semibold text-slate-800">
            Bias Alerts
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Recent fairness and bias monitoring events.
          </p>
        </div>

        <div className="divide-y">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex flex-col gap-4 p-6 md:flex-row md:items-start md:justify-between"
            >
              <div className="flex gap-4">
                <div className="rounded-lg bg-yellow-100 p-3 text-yellow-600">
                  <AlertTriangle size={20} />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-medium text-slate-800">
                      {alert.title}
                    </h3>

                    <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-700">
                      {alert.severity}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    {alert.description}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    {alert.id} • {alert.time}
                  </p>
                </div>
              </div>

              <button className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                View Details
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}