import { AlertCircle, FileText, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

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
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLogs([]);
      setLoading(false);
      return;
    }

    void getAuditLogs(token)
      .then((response) => setLogs(response.data ?? []))
      .catch((loadError) => {
        setError(getErrorMessage(loadError, "Unable to load audit logs."));
        setLogs([]);
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Tenant Admin</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Audit Logs</h1>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5" />
          <span>{error}</span>
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
            <h2 className="text-xl font-semibold text-slate-900">No audit events yet</h2>
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
    </div>
  );
}
