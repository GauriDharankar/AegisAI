import { useEffect, useState } from "react";
import { AlertCircle, ClipboardCheck, CheckCircle, XCircle, ShieldAlert } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import StatCard from "../components/StatCard";
import api from "../services/api";
import { getErrorMessage } from "../services/errorMessage";

interface DashboardApplication {
  id: string;
  applicant_name: string;
  reference_code: string;
  status: string;
  created_at: string;
  governance_result?: {
    fairness?: {
      status?: string;
      message?: string;
    };
  } | null;
}

export default function Dashboard() {
  const { token } = useAuth();
  const [applications, setApplications] = useState<DashboardApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setApplications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    void api.get<DashboardApplication[]>("/api/v1/applications", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((applicationsResponse) => {
        setApplications(applicationsResponse.data ?? []);
      })
      .catch((loadError) => {
        setApplications([]);
        setError(getErrorMessage(loadError, "Unable to load dashboard data."));
      })
      .finally(() => setLoading(false));
  }, [token]);

  const pending = applications.filter((application) => ["new", "in_review", "pending"].includes(application.status.toLowerCase())).length;
  const approved = applications.filter((application) => ["approved", "completed"].includes(application.status.toLowerCase())).length;
  const rejected = applications.filter((application) => application.status.toLowerCase() === "rejected").length;
  const activeAlerts = applications.filter((application) => application.governance_result?.fairness?.status?.toLowerCase() === "violation");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Organization Dashboard
        </h1>

        <p className="mt-1 text-slate-500">
          Overview of the current tenant’s users, teams, responsibilities, reviews, and governance workflow.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border bg-white p-8 text-slate-600">Loading dashboard...</div>
      ) : (
      <>
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
          value={activeAlerts.length}
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
            {applications.length === 0 ? (
              <p className="text-sm text-slate-500">No recent reviews</p>
            ) : applications.slice(0, 4).map((application) => (
              <div
                key={application.id}
                className="flex items-center justify-between border-b pb-4"
              >
                <div>
                  <p className="font-medium">
                    {application.applicant_name}
                  </p>

                  <p className="text-sm text-slate-500">
                    {application.reference_code}
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
            {activeAlerts.length === 0 ? (
              <p className="text-sm text-slate-500">No active alerts</p>
            ) : activeAlerts.map((application) => (
              <div
                key={application.id}
                className="rounded-lg bg-red-50 p-4"
              >
                <p className="font-medium text-red-800">
                  Fairness violation
                </p>

                <p className="mt-1 text-sm text-red-600">
                  {application.reference_code}: {application.governance_result?.fairness?.message ?? "Fairness threshold exceeded."}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}