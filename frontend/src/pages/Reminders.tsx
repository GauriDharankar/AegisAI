import { useCallback, useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";

import { useToast } from "../components/ToastProvider";
import { useAuth } from "../context/AuthContext";
import { getReviewReminders, updateReviewReminders } from "../services/adminService";
import { getErrorMessage } from "../services/errorMessage";

type ReminderInterval = 15 | 30 | 60 | 120;

export default function Reminders() {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [enabled, setEnabled] = useState(true);
  const [interval, setInterval] = useState<ReminderInterval>(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfiguration = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      const response = await getReviewReminders(token);
      const configuration = response.data?.review_reminders;
      setEnabled(configuration?.enabled ?? true);
      setInterval(configuration?.interval_minutes ?? 30);
      setError(null);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Unable to load reminder configuration."));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (user?.role === "MANAGER") {
      void loadConfiguration();
    }
  }, [loadConfiguration, user?.role]);

  const retryConfiguration = () => {
    setLoading(true);
    setError(null);
    void loadConfiguration();
  };

  const saveConfiguration = async () => {
    if (!token || user?.role !== "MANAGER" || saving) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateReviewReminders(token, { enabled, interval_minutes: interval });
      await loadConfiguration();
      showToast("Reminder configuration saved");
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Unable to save reminder configuration."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reminder Scheduler</h1>
        <p className="mt-1 text-slate-500">Configure reminders for pending application reviews.</p>
      </div>

      {user?.role !== "MANAGER" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Reminder configuration is managed by a Tenant Admin. This account can view this notice but cannot change organization-wide reminder settings.
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="flex items-center gap-2"><AlertCircle size={16} />{error}</span>
          {!saving && <button type="button" onClick={retryConfiguration} className="font-medium underline">Retry</button>}
        </div>
      )}

      {user?.role !== "MANAGER" ? null : loading ? (
        <div className="rounded-xl border bg-white p-6 text-slate-600">Loading reminder settings…</div>
      ) : (
        <div className="rounded-xl border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Review Reminders</h2>
              <p className="text-sm text-slate-500">Notify reviewers about pending applications.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label="Enable review reminders"
              onClick={() => setEnabled((current) => !current)}
              className={`relative h-7 w-12 rounded-full ${enabled ? "bg-blue-600" : "bg-slate-300"}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${enabled ? "left-6" : "left-1"}`} />
            </button>
          </div>

          <div className="mt-8">
            <label htmlFor="reminder-interval" className="mb-2 block text-sm font-medium">Reminder Interval</label>
            <select
              id="reminder-interval"
              value={interval}
              onChange={(event) => setInterval(Number(event.target.value) as ReminderInterval)}
              className="w-full rounded-lg border px-4 py-3"
            >
              <option value={15}>Every 15 minutes</option>
              <option value={30}>Every 30 minutes</option>
              <option value={60}>Every hour</option>
              <option value={120}>Every 2 hours</option>
            </select>
          </div>

          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            These settings are stored for this tenant. Reminder delivery requires a reminder worker to be enabled in the deployment.
          </p>

          <button
            type="button"
            onClick={() => void saveConfiguration()}
            disabled={saving || Boolean(error)}
            className="mt-6 rounded-lg bg-blue-600 px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Configuration"}
          </button>
        </div>
      )}
    </div>
  );
}
