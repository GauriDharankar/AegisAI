import { useEffect, useState } from "react";
import { AlertTriangle, Bell, Brain, Clock, Save, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ToastProvider";
import { getConfiguration, updateConfiguration } from "../services/adminService";
import { getErrorMessage } from "../services/errorMessage";

type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

interface AutoApprovalSettings {
  enabled: boolean;
  minimum_probability: number;
  maximum_risk: RiskLevel;
  eligible_loan_types: string[];
  require_policy_compliance: boolean;
  require_fairness_pass: boolean;
}

interface AutoApprovalResponse {
  enabled?: boolean;
  minimum_probability?: number;
  maximum_risk?: RiskLevel;
  eligible_loan_types?: string[];
  require_policy_compliance?: boolean;
  require_fairness_pass?: boolean;
}

export const probabilityToPercentage = (probability: number) => probability * 100;
export const percentageToProbability = (percentage: number) => percentage / 100;

const defaultSettings: AutoApprovalSettings = {
  enabled: false,
  minimum_probability: 85,
  maximum_risk: "LOW",
  eligible_loan_types: [],
  require_policy_compliance: true,
  require_fairness_pass: true,
};

const toUiSettings = (settings: AutoApprovalResponse): AutoApprovalSettings => ({
  ...defaultSettings,
  ...settings,
  minimum_probability: probabilityToPercentage(
    settings.minimum_probability ?? percentageToProbability(defaultSettings.minimum_probability),
  ),
});

const toApiSettings = (settings: AutoApprovalSettings) => ({
  ...settings,
  minimum_probability: percentageToProbability(settings.minimum_probability),
});

export default function Configuration() {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoadError("Your session has expired. Sign in again to manage configuration.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    void getConfiguration(token)
      .then((response) => {
        setSettings(toUiSettings(response.data?.auto_approve ?? {}));
        setLoaded(true);
      })
      .catch((error) => setLoadError(getErrorMessage(error, "Unable to load configuration.")))
      .finally(() => setLoading(false));
  }, [token]);

  const updateSetting = <K extends keyof AutoApprovalSettings>(key: K, value: AutoApprovalSettings[K]) => {
    setLoadError(null);
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    if (!token) return;
    if (!Number.isFinite(settings.minimum_probability) ||
      settings.minimum_probability < 0 || settings.minimum_probability > 100) {
      setLoadError("Minimum approval probability must be between 0 and 100.");
      return;
    }
    setLoadError(null);
    setSaving(true);
    try {
      const response = await updateConfiguration(token, { auto_approve: toApiSettings(settings) });
      setSettings(toUiSettings(response.data?.auto_approve ?? toApiSettings(settings)));
      setLoaded(true);
      showToast("Settings saved successfully");
    } catch (error) {
      setLoadError(getErrorMessage(error, "Unable to save configuration."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="rounded-xl border bg-white p-6 text-slate-600">Loading configuration...</div>;
  }

  if (!loaded) {
    return (
      <div className="rounded-xl border border-red-200 bg-white p-6">
        <p role="alert" className="text-sm text-red-700">{loadError ?? "Configuration could not be loaded."}</p>
        <button
          type="button"
          onClick={() => {
            if (!token) return;
            setLoading(true);
            setLoadError(null);
            void getConfiguration(token)
              .then((response) => {
                setSettings(toUiSettings(response.data?.auto_approve ?? {}));
                setLoaded(true);
              })
              .catch((error) => setLoadError(getErrorMessage(error, "Unable to load configuration.")))
              .finally(() => setLoading(false));
          }}
          disabled={!token || loading}
          className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-blue-600">System Settings</p>
          <h1 className="text-2xl font-bold text-slate-800">Configuration</h1>
          <p className="mt-1 text-sm text-slate-500">Configure tenant-specific AI governance controls.</p>
        </div>
        <button type="button" onClick={handleSave} disabled={saving} className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
          <Save size={18} />
          {saving ? "Saving..." : "Save Configuration"}
        </button>
      </div>

      {loadError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-blue-100 p-3 text-blue-600"><ShieldCheck size={24} /></div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Active Tenant</p>
            <h2 className="mt-1 text-lg font-bold text-slate-800">{user?.tenant_name ?? "Current Organization"}</h2>
            <p className="text-sm text-slate-500">Tenant-scoped governance configuration</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-6 py-5">
          <h2 className="font-semibold text-slate-800">Auto-Approval Configuration</h2>
          <p className="mt-1 text-sm text-slate-500">Define when an application can bypass human review.</p>
        </div>
        <div className="space-y-6 p-6">
          <label className="flex items-center justify-between">
            <span>
              <span className="block font-medium text-slate-700">Enable Auto Approval</span>
              <span className="block text-sm text-slate-500">Allow eligible applications to be automatically approved.</span>
            </span>
            <input type="checkbox" checked={settings.enabled} disabled={saving} onChange={(event) => updateSetting("enabled", event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
          </label>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Minimum Approval Probability</label>
              <div className="mt-2 flex items-center gap-2">
                <input type="number" min="0" max="100" step="0.01" value={settings.minimum_probability} disabled={saving} onChange={(event) => updateSetting("minimum_probability", event.target.value === "" ? Number.NaN : Number(event.target.value))} className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
                <span className="text-sm text-slate-500">%</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Maximum Allowed Risk</label>
              <select value={settings.maximum_risk} disabled={saving} onChange={(event) => updateSetting("maximum_risk", event.target.value as RiskLevel)} className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500">
                <option>LOW</option><option>MEDIUM</option><option>HIGH</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Eligible Loan Types</label>
              <input value={settings.eligible_loan_types.join(", ")} disabled={saving} onChange={(event) => updateSetting("eligible_loan_types", event.target.value.split(",").map((value) => value.trim()).filter(Boolean))} placeholder="personal, auto, mortgage" className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={settings.require_policy_compliance} disabled={saving} onChange={(event) => updateSetting("require_policy_compliance", event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />Require policy compliance</label>
            <label className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={settings.require_fairness_pass} disabled={saving} onChange={(event) => updateSetting("require_fairness_pass", event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />Require fairness check to pass</label>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Link to="/admin/audit" className="rounded-xl border bg-white shadow-sm transition hover:border-slate-300">
          <div className="flex items-center gap-3 border-b px-6 py-5"><AlertTriangle size={20} className="text-yellow-600" /><h2 className="font-semibold text-slate-800">Override Monitoring</h2></div>
          <div className="p-6 text-sm text-slate-500">Review recorded governance and override activity in the audit log.</div>
        </Link>
        <Link to="/reminders" className="rounded-xl border bg-white shadow-sm transition hover:border-slate-300">
          <div className="flex items-center gap-3 border-b px-6 py-5"><Clock size={20} className="text-blue-600" /><h2 className="font-semibold text-slate-800">Reminder Scheduler</h2></div>
          <div className="p-6 text-sm text-slate-500">Configure reminder preferences. Delivery requires a deployed reminder worker.</div>
        </Link>
      </div>
      <Link to="/admin/settings" className="block rounded-xl border bg-white shadow-sm transition hover:border-slate-300">
        <div className="flex items-center gap-3 border-b px-6 py-5"><Brain size={20} className="text-purple-600" /><h2 className="font-semibold text-slate-800">Risk Routing Configuration</h2></div>
        <div className="p-6 text-sm text-slate-500">Configure tenant risk-based team routing and review stages.</div>
      </Link>
      <Link to="/notifications" className="block rounded-xl border bg-white shadow-sm transition hover:border-slate-300">
        <div className="flex items-center gap-3 border-b px-6 py-5"><Bell size={20} className="text-indigo-600" /><h2 className="font-semibold text-slate-800">Governance Activity</h2></div>
        <div className="p-6 text-sm text-slate-500">Review persisted tenant activity and governance notifications.</div>
      </Link>
    </div>
  );
}
