import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, RefreshCw, Search, ShieldAlert } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { getErrorMessage } from "../services/errorMessage";
import { formatIstTimestamp } from "../utils/dateTime";

interface HunterAlert {
  alert_id: string;
  recipient_tenant_id: string;
  application_id: string;
  alert_type: string;
  severity: string;
  status: string;
  loan_type: string;
  message: string;
  created_at?: string | null;
}

export default function HunterAlerts() {
  const { token } = useAuth();
  const [alerts, setAlerts] = useState<HunterAlert[]>([]);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    if (!token) {
      setAlerts([]);
      setError("Authentication is required to load Hunter alerts.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await api.get<HunterAlert[]>("/api/v1/hunter/alerts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAlerts(response.data ?? []);
      setError(null);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Unable to load Hunter alerts."));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const statusOptions = useMemo(
    () => [...new Set(alerts.map((alert) => alert.status.toUpperCase()))].sort(),
    [alerts],
  );
  const normalizedSearch = search.trim().toLowerCase();
  const filteredAlerts = alerts.filter((alert) => {
    const matchesSearch = !normalizedSearch || [
      alert.application_id,
      alert.message,
      alert.loan_type,
      alert.alert_type,
    ].some((value) => value.toLowerCase().includes(normalizedSearch));
    const matchesSeverity = severityFilter === "ALL" || alert.severity.toUpperCase() === severityFilter;
    const matchesStatus = statusFilter === "ALL" || alert.status.toUpperCase() === statusFilter;
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hunter Alerts</h1>
          <p className="mt-1 text-slate-500">Review cross-tenant duplicate-loan alerts for your organization.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadAlerts()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="flex items-center gap-2"><AlertCircle size={16} />{error}</span>
          <button type="button" onClick={() => void loadAlerts()} disabled={loading} className="font-medium underline disabled:opacity-50">
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search Hunter alerts</span>
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search application ID, message, or loan type"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span>Severity</span>
          <select
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="ALL">All severities</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="ALL">All statuses</option>
            {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-slate-500">
            <RefreshCw size={18} className="mr-2 animate-spin" />
            Loading Hunter alerts…
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            {alerts.length === 0 ? "No Hunter alerts found" : "No Hunter alerts match your filters."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3">Application ID</th>
                  <th scope="col" className="px-5 py-3">Alert</th>
                  <th scope="col" className="px-5 py-3">Severity</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  <th scope="col" className="px-5 py-3">Loan type</th>
                  <th scope="col" className="px-5 py-3">Timestamp</th>
                  <th scope="col" className="px-5 py-3">Required action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAlerts.map((alert) => {
                  const highSeverity = alert.severity.toUpperCase() === "HIGH";
                  const duplicateAlert = alert.alert_type === "DUPLICATE_LOAN_APPLICATION";
                  return (
                    <tr key={alert.alert_id} className={highSeverity ? "bg-red-50/40" : ""}>
                      <td className="px-5 py-4 font-mono text-xs text-slate-700">{alert.application_id}</td>
                      <td className="max-w-sm px-5 py-4 text-slate-700">
                        <div className="flex items-start gap-2">
                          {highSeverity && <ShieldAlert size={17} className="mt-0.5 shrink-0 text-red-600" />}
                          <span>{alert.message}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          highSeverity ? "bg-red-100 text-red-800 ring-1 ring-inset ring-red-200" : "bg-amber-50 text-amber-800"
                        }`}>
                          {alert.severity.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {alert.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-4 capitalize text-slate-700">{alert.loan_type}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-slate-500">{formatIstTimestamp(alert.created_at)}</td>
                      <td className="px-5 py-4">
                        {duplicateAlert ? (
                          <span className="inline-flex whitespace-nowrap rounded-md bg-red-100 px-2.5 py-1.5 text-xs font-semibold text-red-800">
                            Manual Review Required
                          </span>
                        ) : (
                          <span className="text-slate-500">Review alert</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
