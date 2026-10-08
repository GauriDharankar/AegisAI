import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { reviewService, type ReviewerApplication } from "../services/reviewService";
import { getErrorMessage } from "../services/errorMessage";

export default function ReviewQueue() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [applications, setApplications] = useState<ReviewerApplication[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadApplications = async () => {
      if (!token) {
        setApplications([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await reviewService.getPendingReviews(token);
        setApplications(data ?? []);
      } catch (loadError) {
        setApplications([]);
        setError(getErrorMessage(loadError, "Unable to load reviewer queue."));
      } finally {
        setLoading(false);
      }
    };

    void loadApplications();
  }, [token]);

  const statusOptions = useMemo(
    () => Array.from(new Set(applications.map((application) => application.status))).sort(),
    [applications]
  );

  const filteredApplications = useMemo(() => {
    const query = search.trim().toLowerCase();

    return applications.filter((application) => {
      const matchesSearch =
        !query ||
        application.reference_code.toLowerCase().includes(query) ||
        application.applicant_name.toLowerCase().includes(query);

      const matchesStatus = status === "ALL" || application.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [applications, search, status]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Review Queue</h1>

        <p className="mt-1 text-slate-500">
          Applications requiring human intervention.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border bg-white p-4 md:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-slate-100 px-4 py-2">
          <Search size={18} className="text-slate-400" />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search applicant or application ID..."
            className="w-full bg-transparent outline-none"
          />
        </div>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-lg border px-4 py-2"
        >
          <option value="ALL">All Statuses</option>
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border bg-white p-12 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading reviewer queue...
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5" />
          <span>{error}</span>
        </div>
      ) : filteredApplications.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-slate-500">
          No applications are currently assigned to your reviewer queue.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr className="text-left text-sm text-slate-500">
                  <th className="px-6 py-4">Application</th>
                  <th className="px-6 py-4">Applicant</th>
                  <th className="px-6 py-4">Routing</th>
                  <th className="px-6 py-4">Assigned Team</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredApplications.map((application) => (
                  <tr key={application.id} className="border-t hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium">{application.reference_code}</td>
                    <td className="px-6 py-4">{application.applicant_name}</td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                        {application.routing_mode === "RISK_BASED_SINGLE_REVIEW"
                          ? `${application.risk_level ?? "Unknown"} risk`
                          : application.current_workflow_stage ?? "Unassigned"}
                      </span>
                    </td>
                    <td className="px-6 py-4">{application.assigned_team_name ?? "Unassigned"}</td>
                    <td className="px-6 py-4">{application.status}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => navigate(`/reviews/${application.id}`)}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                      >
                        Review Application
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}