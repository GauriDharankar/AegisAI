import { ShieldAlert, Settings } from "lucide-react";
import { biasAlerts } from "../data/mockData";

export default function BiasAlerts() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row">
        <div>
          <h1 className="text-2xl font-bold">
            Bias Alerts
          </h1>

          <p className="mt-1 text-slate-500">
            Monitor fairness and override thresholds.
          </p>
        </div>

        <button className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2">
          <Settings size={18} />
          Configure Threshold
        </button>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-slate-500">
            Override Threshold
          </p>

          <p className="mt-2 text-3xl font-bold">
            15%
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Current configured limit
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-slate-500">
            Active Alerts
          </p>

          <p className="mt-2 text-3xl font-bold text-red-600">
            {biasAlerts.length}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-slate-500">
            Monitoring Status
          </p>

          <p className="mt-2 text-lg font-semibold text-green-600">
            Active
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {biasAlerts.map((alert) => (
          <div
            key={alert.id}
            className="rounded-xl border bg-white p-6"
          >
            <div className="flex gap-4">
              <div className="rounded-lg bg-red-50 p-3 text-red-600">
                <ShieldAlert />
              </div>

              <div className="flex-1">
                <div className="flex flex-col justify-between gap-2 md:flex-row">
                  <h2 className="font-semibold">
                    {alert.title}
                  </h2>

                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs text-red-700">
                    {alert.severity}
                  </span>
                </div>

                <p className="mt-2 text-sm text-slate-600">
                  {alert.description}
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div>
                    <p className="text-xs text-slate-500">
                      Override Rate
                    </p>
                    <p className="font-semibold">
                      {alert.overrideRate}%
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Threshold
                    </p>
                    <p className="font-semibold">
                      {alert.threshold}%
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Created
                    </p>
                    <p className="font-semibold">
                      {alert.createdAt}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}