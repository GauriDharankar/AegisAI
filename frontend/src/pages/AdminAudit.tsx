import { AlertCircle, FileText, Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { getAuditLogs } from "../services/adminService";
import { getErrorMessage } from "../services/errorMessage";

interface AuditLogRecord {
  id: string;
  actor_name?: string | null;
  actor_email?: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export default function AdminAudit() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState(searchParams.get("action") ?? "");
  const [resourceFilter, setResourceFilter] = useState(searchParams.get("resource_type") ?? "");
  const [hasMore, setHasMore] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);
  const pageSize = 50;
  const search = searchParams.get("search") ?? "";
  const action = searchParams.get("action") ?? "";
  const resourceType = searchParams.get("resource_type") ?? "";
  const offset = Number(searchParams.get("offset") ?? 0);

  useEffect(() => {
    if (!token) {
      return;
    }

    void getAuditLogs(token, { search, action, resource_type: resourceType, limit: pageSize + 1, offset })
      .then((response) => {
        const result = response.data ?? [];
        setLogs(result.slice(0, pageSize));
        setHasMore(result.length > pageSize);
        setError(null);
      })
      .catch((loadError) => {
        setError(getErrorMessage(loadError, "Unable to load audit logs."));
        setLogs([]);
        setHasMore(false);
      })
      .finally(() => setLoading(false));
  }, [token, search, action, resourceType, offset, reloadCount]);

  const applyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (actionFilter.trim()) next.set("action", actionFilter.trim());
    else next.delete("action");
    if (resourceFilter.trim()) next.set("resource_type", resourceFilter.trim());
    else next.delete("resource_type");
    next.delete("offset");
    setSearchParams(next);
  };

  const updateSearch = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("search", value);
    else next.delete("search");
    next.delete("offset");
    setSearchParams(next);
  };

  const updateOffset = (value: number) => {
    const next = new URLSearchParams(searchParams);
    if (value > 0) next.set("offset", String(value));
    else next.delete("offset");
    setSearchParams(next);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Tenant Admin</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Audit Logs</h1>
      </div>

      <form onSubmit={applyFilters} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[2fr_1fr_1fr_auto]">
        <label className="relative">
          <span className="sr-only">Search audit events</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="Search actor, action, or resource" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" />
        </label>
        <label>
          <span className="sr-only">Filter by action</span>
          <input value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} placeholder="Action" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label>
          <span className="sr-only">Filter by resource type</span>
          <select value={resourceFilter} onChange={(event) => setResourceFilter(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">All resources</option>
            <option value="organization">Organization</option>
            <option value="tenant_configuration">Tenant configuration</option>
            <option value="user">User</option>
            <option value="team">Team</option>
            <option value="workflow">Workflow</option>
          </select>
        </label>
        <button type="submit" className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Apply filters</button>
      </form>

      {error && (
        <div role="alert" className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="flex items-start gap-2"><AlertCircle size={16} className="mt-0.5" />{error}</span>
          <button type="button" onClick={() => setReloadCount((value) => value + 1)} disabled={loading} className="font-medium underline disabled:opacity-50">Retry</button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading audit logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="mb-4 rounded-full bg-slate-100 p-4 text-slate-700">
              <FileText size={28} />
            </div>
            <h2 className="text-xl font-semibold text-slate-900">No audit events found</h2>
            <p className="mt-2 text-sm text-slate-500">Events for this tenant will appear here as workflow activity occurs.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Resource</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{log.actor_name ?? "System"}</div>
                      {log.actor_email && <div className="text-xs text-slate-500">{log.actor_email}</div>}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{log.action}</td>
                    <td className="px-4 py-3 text-slate-600">{log.resource_type} / {log.resource_id}</td>
                    <td className="max-w-sm px-4 py-3 text-xs text-slate-500">{JSON.stringify(log.metadata ?? {})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && !error && (
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => updateOffset(Math.max(0, offset - pageSize))} disabled={offset === 0} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
          <span className="text-sm text-slate-500">Showing {logs.length ? offset + 1 : 0}–{offset + logs.length}</span>
          <button type="button" onClick={() => updateOffset(offset + pageSize)} disabled={!hasMore} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
