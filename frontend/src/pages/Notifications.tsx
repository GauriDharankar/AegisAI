import { AlertCircle, Bell, Check, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { notifications } from "../data/mockData";
import { useAuth } from "../context/AuthContext";
import { getAuditLogs } from "../services/adminService";
import { getErrorMessage } from "../services/errorMessage";
import { formatIstTimestamp } from "../utils/dateTime";

export default function Notifications() {
  const { token, user } = useAuth();
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActivity = useCallback(async () => {
    if (!token || user?.role !== "MANAGER") {
      return;
    }
    try {
      const response = await getAuditLogs(token, { limit: 100 });
      setActivity(response.data ?? []);
      setError(null);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Unable to load tenant activity."));
    } finally {
      setLoading(false);
    }
  }, [token, user?.role]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  const retryActivity = () => {
    setLoading(true);
    setError(null);
    void loadActivity();
  };

  if (user?.role === "MANAGER") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="mt-1 text-slate-500">Persisted activity recorded for your organization.</p>
        </div>
        {error && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span className="flex items-center gap-2"><AlertCircle size={16} />{error}</span>
            <button type="button" onClick={retryActivity} disabled={loading} className="font-medium underline disabled:opacity-50">Retry</button>
          </div>
        )}
        <div className="overflow-hidden rounded-xl border bg-white">
          {loading ? (
            <div className="flex items-center justify-center p-12 text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading activity…</div>
          ) : activity.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No persisted organization activity is available yet.</div>
          ) : activity.map((event) => (
            <div key={event.id} className="flex gap-4 border-b p-6 last:border-b-0">
              <div className="rounded-full bg-blue-100 p-3 text-blue-600"><Bell size={18} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-semibold text-slate-900">{String(event.action).replaceAll("_", " ")}</h2>
                  <time className="text-xs text-slate-400">{formatIstTimestamp(event.timestamp)}</time>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {event.actor_name ?? "System"} · {event.resource_type} · {event.resource_id}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Notifications
        </h1>

        <p className="mt-1 text-slate-500">
          Review system alerts and assigned tasks.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`flex gap-4 border-b p-6 ${
              !notification.read
                ? "bg-blue-50/50"
                : ""
            }`}
          >
            <div className="rounded-full bg-blue-100 p-3 text-blue-600">
              <Bell size={18} />
            </div>

            <div className="flex-1">
              <div className="flex justify-between">
                <h2 className="font-semibold">
                  {notification.title}
                </h2>

                {!notification.read && (
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                )}
              </div>

              <p className="mt-1 text-sm text-slate-600">
                {notification.message}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                {notification.createdAt}
              </p>
            </div>

            {!notification.read && (
              <button className="text-slate-400 hover:text-blue-600">
                <Check size={18} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}