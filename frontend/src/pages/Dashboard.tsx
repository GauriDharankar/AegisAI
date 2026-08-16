import {
  ClipboardCheck,
  CheckCircle,
  XCircle,
  ShieldAlert,
} from "lucide-react";

import StatCard from "../components/StatCard";
import { applications, biasAlerts } from "../data/mockData";

export default function Dashboard() {
  const pending = applications.filter(
    (app) => app.status === "PENDING"
  ).length;

  const approved = applications.filter(
    (app) => app.status === "APPROVED"
  ).length;

  const rejected = applications.filter(
    (app) => app.status === "REJECTED"
  ).length;

  const alerts = biasAlerts.filter(
    (alert) => alert.status === "OPEN"
  ).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Review Dashboard
        </h1>

        <p className="mt-1 text-slate-500">
          Overview of AI decision monitoring and human reviews.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Pending Reviews"
          value={pending}
          description="Applications waiting for review"
          icon={<ClipboardCheck />}
        />

        <StatCard
          title="Approved"
          value={approved}
          description="Human-approved applications"
          icon={<CheckCircle />}
        />

        <StatCard
          title="Rejected"
          value={rejected}
          description="Rejected applications"
          icon={<XCircle />}
        />

        <StatCard
          title="Bias Alerts"
          value={alerts}
          description="Active governance alerts"
          icon={<ShieldAlert />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border bg-white p-6 lg:col-span-2">
          <h2 className="mb-5 text-lg font-semibold">
            Recent Reviews
          </h2>

          <div className="space-y-4">
            {applications.slice(0, 4).map((application) => (
              <div
                key={application.id}
                className="flex items-center justify-between border-b pb-4"
              >
                <div>
                  <p className="font-medium">
                    {application.applicantName}
                  </p>

                  <p className="text-sm text-slate-500">
                    {application.id}
                  </p>
                </div>

                <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
                  {application.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <h2 className="mb-5 text-lg font-semibold">
            Active Alerts
          </h2>

          <div className="space-y-4">
            {biasAlerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-lg bg-red-50 p-4"
              >
                <p className="font-medium text-red-800">
                  {alert.title}
                </p>

                <p className="mt-1 text-sm text-red-600">
                  {alert.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}