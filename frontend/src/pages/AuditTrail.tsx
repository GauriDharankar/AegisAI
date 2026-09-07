import {
  Search,
  FileText,
  UserCheck,
  ShieldAlert,
  Settings,
  Scale,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
} from "lucide-react";

const auditLogs = [
  {
    id: "AUD-1001",
    timestamp: "07 Sep 2026, 10:42 AM",
    actor: "Rahul Sharma",
    role: "Human Reviewer",
    action: "Decision Override",
    description:
      "AI approval decision was overridden after manual review.",
    applicationId: "APP-1001",
    result: "APPROVED",
    severity: "INFO",
    icon: UserCheck,
  },
  {
    id: "AUD-1002",
    timestamp: "07 Sep 2026, 10:35 AM",
    actor: "AegisAI Engine",
    role: "System",
    action: "Policy Violation",
    description:
      "Application violated the minimum credit score policy.",
    applicationId: "APP-1002",
    result: "REVIEW_REQUIRED",
    severity: "WARNING",
    icon: ShieldAlert,
  },
  {
    id: "AUD-1003",
    timestamp: "07 Sep 2026, 10:30 AM",
    actor: "AegisAI Engine",
    role: "System",
    action: "Fairness Evaluation",
    description:
      "Fairness evaluation completed successfully for the latest batch.",
    applicationId: "BATCH-092",
    result: "PASSED",
    severity: "INFO",
    icon: Scale,
  },
  {
    id: "AUD-1004",
    timestamp: "07 Sep 2026, 09:50 AM",
    actor: "Admin User",
    role: "System Administrator",
    action: "Configuration Updated",
    description:
      "Override alert threshold was changed from 15% to 20%.",
    applicationId: "SYSTEM",
    result: "UPDATED",
    severity: "INFO",
    icon: Settings,
  },
  {
    id: "AUD-1005",
    timestamp: "07 Sep 2026, 09:35 AM",
    actor: "AegisAI Engine",
    role: "System",
    action: "Application Evaluation",
    description:
      "AI governance pipeline completed evaluation of loan application.",
    applicationId: "APP-1003",
    result: "APPROVED",
    severity: "INFO",
    icon: FileText,
  },
  {
    id: "AUD-1006",
    timestamp: "07 Sep 2026, 09:15 AM",
    actor: "Priya Mehta",
    role: "Compliance Officer",
    action: "Policy Review",
    description:
      "Compliance officer reviewed a flagged governance policy.",
    applicationId: "APP-1004",
    result: "REVIEWED",
    severity: "INFO",
    icon: Eye,
  },
  {
    id: "AUD-1007",
    timestamp: "07 Sep 2026, 08:55 AM",
    actor: "AegisAI Engine",
    role: "System",
    action: "Bias Alert",
    description:
      "Override rate exceeded the configured monitoring threshold.",
    applicationId: "BATCH-091",
    result: "ALERT",
    severity: "CRITICAL",
    icon: ShieldAlert,
  },
];

export default function AuditTrail() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-blue-600">
            Governance Monitoring
          </p>

          <h1 className="text-2xl font-bold text-slate-800">
            Audit Trail
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Track governance decisions, policy events, overrides,
            fairness checks and system activities.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Total Events */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Total Events
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-800">
                1,284
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Last 30 days
              </p>
            </div>

            <div className="rounded-lg bg-blue-100 p-3 text-blue-600">
              <FileText size={22} />
            </div>
          </div>
        </div>

        {/* Overrides */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Decision Overrides
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-800">
                42
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Human reviewer actions
              </p>
            </div>

            <div className="rounded-lg bg-purple-100 p-3 text-purple-600">
              <UserCheck size={22} />
            </div>
          </div>
        </div>

        {/* Policy violations */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Policy Violations
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-800">
                18
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Detected this month
              </p>
            </div>

            <div className="rounded-lg bg-yellow-100 p-3 text-yellow-600">
              <ShieldAlert size={22} />
            </div>
          </div>
        </div>

        {/* Critical */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Critical Events
              </p>

              <p className="mt-2 text-2xl font-bold text-red-600">
                3
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Require attention
              </p>
            </div>

            <div className="rounded-lg bg-red-100 p-3 text-red-600">
              <XCircle size={22} />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row">
          {/* Search */}
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              placeholder="Search by application ID, actor or action..."
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Event Type */}
          <select className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 outline-none focus:border-blue-500">
            <option>All Events</option>
            <option>Decision Override</option>
            <option>Policy Violation</option>
            <option>Fairness Evaluation</option>
            <option>Bias Alert</option>
            <option>Configuration Updated</option>
            <option>Application Evaluation</option>
          </select>

          {/* Severity */}
          <select className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 outline-none focus:border-blue-500">
            <option>All Severity</option>
            <option>Info</option>
            <option>Warning</option>
            <option>Critical</option>
          </select>

          {/* Date */}
          <select className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 outline-none focus:border-blue-500">
            <option>Last 30 Days</option>
            <option>Last 7 Days</option>
            <option>Today</option>
            <option>Last 90 Days</option>
          </select>
        </div>
      </div>

      {/* Audit Table */}
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b px-6 py-5">
          <h2 className="font-semibold text-slate-800">
            Governance Activity
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Immutable record of important AegisAI governance events.
          </p>
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Event
                </th>

                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Actor
                </th>

                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Application
                </th>

                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Result
                </th>

                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Severity
                </th>

                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Timestamp
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {auditLogs.map((log) => {
                const Icon = log.icon;

                return (
                  <tr
                    key={log.id}
                    className="transition hover:bg-slate-50"
                  >
                    {/* Event */}
                    <td className="px-6 py-5">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                          <Icon size={18} />
                        </div>

                        <div>
                          <p className="font-medium text-slate-800">
                            {log.action}
                          </p>

                          <p className="mt-1 max-w-sm text-xs text-slate-500">
                            {log.description}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {log.id}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Actor */}
                    <td className="px-6 py-5">
                      <p className="text-sm font-medium text-slate-700">
                        {log.actor}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {log.role}
                      </p>
                    </td>

                    {/* Application */}
                    <td className="px-6 py-5">
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-600">
                        {log.applicationId}
                      </span>
                    </td>

                    {/* Result */}
                    <td className="px-6 py-5">
                      <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                        {log.result}
                      </span>
                    </td>

                    {/* Severity */}
                    <td className="px-6 py-5">
                      {log.severity === "CRITICAL" ? (
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                          CRITICAL
                        </span>
                      ) : log.severity === "WARNING" ? (
                        <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-700">
                          WARNING
                        </span>
                      ) : (
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                          INFO
                        </span>
                      )}
                    </td>

                    {/* Timestamp */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Clock size={15} />
                        {log.timestamp}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y lg:hidden">
          {auditLogs.map((log) => {
            const Icon = log.icon;

            return (
              <div key={log.id} className="p-5">
                <div className="flex gap-3">
                  <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                    <Icon size={18} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-slate-800">
                        {log.action}
                      </h3>

                      {log.severity === "CRITICAL" ? (
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                          CRITICAL
                        </span>
                      ) : log.severity === "WARNING" ? (
                        <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
                          WARNING
                        </span>
                      ) : (
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                          INFO
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-sm text-slate-500">
                      {log.description}
                    </p>

                    <div className="mt-4 grid gap-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-400">
                          ACTOR
                        </p>

                        <p className="mt-1 font-medium text-slate-700">
                          {log.actor}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">
                          APPLICATION
                        </p>

                        <p className="mt-1 font-mono text-xs text-slate-600">
                          {log.applicationId}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">
                          RESULT
                        </p>

                        <span className="mt-1 inline-block rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                          {log.result}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">
                          TIMESTAMP
                        </p>

                        <p className="mt-1 text-slate-500">
                          {log.timestamp}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Integrity information */}
      <div className="flex flex-col gap-4 rounded-xl border border-green-200 bg-green-50 p-5 md:flex-row md:items-center">
        <div className="rounded-lg bg-green-100 p-3 text-green-600">
          <CheckCircle2 size={22} />
        </div>

        <div>
          <h3 className="font-semibold text-green-800">
            Audit Trail Integrity
          </h3>

          <p className="mt-1 text-sm text-green-700">
            Audit events are designed to provide a tamper-evident
            record of governance activities.
          </p>
        </div>
      </div>
    </div>
  );
}