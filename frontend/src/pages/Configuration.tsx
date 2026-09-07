import {
  Save,
  ShieldCheck,
  Brain,
  Bell,
  Clock,
  AlertTriangle,
} from "lucide-react";

export default function Configuration() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-blue-600">
            System Settings
          </p>

          <h1 className="text-2xl font-bold text-slate-800">
            Configuration
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Configure tenant-specific AI governance controls.
          </p>
        </div>

        <button className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700">
          <Save size={18} />
          Save Configuration
        </button>
      </div>

      {/* Tenant */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-blue-100 p-3 text-blue-600">
            <ShieldCheck size={24} />
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Active Tenant
            </p>

            <h2 className="mt-1 text-lg font-bold text-slate-800">
              Bank 001
            </h2>

            <p className="text-sm text-slate-500">
              FinTech Lending Tenant
            </p>
          </div>
        </div>
      </div>

      {/* Fairness */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b px-6 py-5">
          <div className="rounded-lg bg-green-100 p-2 text-green-600">
            <ShieldCheck size={20} />
          </div>

          <div>
            <h2 className="font-semibold text-slate-800">
              Fairness Configuration
            </h2>

            <p className="text-sm text-slate-500">
              Configure demographic fairness monitoring.
            </p>
          </div>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700">
              Fairness Analysis
            </label>

            <select className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500">
              <option>Enabled</option>
              <option>Disabled</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Fairness Metric
            </label>

            <select className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500">
              <option>Demographic Parity</option>
              <option>Equal Opportunity</option>
              <option>Equalized Odds</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Disparity Threshold
            </label>

            <div className="mt-2 flex">
              <input
                type="number"
                defaultValue={10}
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
              />

              <span className="ml-2 flex items-center text-sm text-slate-500">
                %
              </span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Minimum Group Size
            </label>

            <input
              type="number"
              defaultValue={2}
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Model & Risk */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b px-6 py-5">
          <div className="rounded-lg bg-purple-100 p-2 text-purple-600">
            <Brain size={20} />
          </div>

          <div>
            <h2 className="font-semibold text-slate-800">
              Model & Risk Configuration
            </h2>

            <p className="text-sm text-slate-500">
              Configure risk classification and model decision thresholds.
            </p>
          </div>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700">
              Low Risk Probability
            </label>

            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                defaultValue={85}
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
              />

              <span className="text-sm text-slate-500">
                %
              </span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Medium Risk Probability
            </label>

            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                defaultValue={65}
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
              />

              <span className="text-sm text-slate-500">
                %
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Auto Approval */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-6 py-5">
          <h2 className="font-semibold text-slate-800">
            Auto-Approval Configuration
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Define when an application can bypass human review.
          </p>
        </div>

        <div className="space-y-6 p-6">
          {/* Enable */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-700">
                Enable Auto Approval
              </p>

              <p className="text-sm text-slate-500">
                Allow eligible applications to be automatically approved.
              </p>
            </div>

            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                defaultChecked
                className="peer sr-only"
              />

              <div className="h-6 w-11 rounded-full bg-slate-300 peer-checked:bg-blue-600 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Minimum Approval Probability
              </label>

              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  defaultValue={85}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                />

                <span className="text-sm text-slate-500">
                  %
                </span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Maximum Allowed Risk
              </label>

              <select className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500">
                <option>LOW</option>
                <option>MEDIUM</option>
              </select>
            </div>
          </div>

          {/* Requirements */}
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />

              <span className="text-sm text-slate-700">
                Require policy compliance
              </span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />

              <span className="text-sm text-slate-700">
                Require fairness check to pass
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Override & Alerts */}
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b px-6 py-5">
            <div className="rounded-lg bg-yellow-100 p-2 text-yellow-600">
              <AlertTriangle size={20} />
            </div>

            <div>
              <h2 className="font-semibold text-slate-800">
                Override Monitoring
              </h2>

              <p className="text-sm text-slate-500">
                Configure bias alert thresholds.
              </p>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Override Alert Threshold
              </label>

              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  defaultValue={20}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                />

                <span className="text-sm text-slate-500">
                  %
                </span>
              </div>

              <p className="mt-1 text-xs text-slate-400">
                Generate a bias alert when overrides exceed this percentage.
              </p>
            </div>
          </div>
        </div>

        {/* Reminder */}
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b px-6 py-5">
            <div className="rounded-lg bg-blue-100 p-2 text-blue-600">
              <Clock size={20} />
            </div>

            <div>
              <h2 className="font-semibold text-slate-800">
                Reminder Scheduler
              </h2>

              <p className="text-sm text-slate-500">
                Configure pending review reminders.
              </p>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Reminder Interval
              </label>

              <select className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500">
                <option>Every 30 minutes</option>
                <option>Every 1 hour</option>
                <option>Every 2 hours</option>
                <option>Every 4 hours</option>
                <option>Every 24 hours</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b px-6 py-5">
          <div className="rounded-lg bg-indigo-100 p-2 text-indigo-600">
            <Bell size={20} />
          </div>

          <div>
            <h2 className="font-semibold text-slate-800">
              Notification Settings
            </h2>

            <p className="text-sm text-slate-500">
              Configure governance notifications.
            </p>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-700">
                Human Review Alerts
              </p>

              <p className="text-sm text-slate-500">
                Notify reviewers when an application requires human review.
              </p>
            </div>

            <input
              type="checkbox"
              defaultChecked
              className="h-4 w-4"
            />
          </label>

          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-700">
                Fairness Alerts
              </p>

              <p className="text-sm text-slate-500">
                Notify administrators when fairness thresholds are exceeded.
              </p>
            </div>

            <input
              type="checkbox"
              defaultChecked
              className="h-4 w-4"
            />
          </label>

          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-700">
                Policy Violation Alerts
              </p>

              <p className="text-sm text-slate-500">
                Notify reviewers when governance policies are violated.
              </p>
            </div>

            <input
              type="checkbox"
              defaultChecked
              className="h-4 w-4"
            />
          </label>
        </div>
      </div>
    </div>
  );
}