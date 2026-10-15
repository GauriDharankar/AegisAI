import { useCallback, useEffect, useState } from "react";
import { Shield, SlidersHorizontal, UserCircle2 } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import {
  getOrganization,
  getRiskRouting,
  getTeams,
  updateOrganization,
  updateRiskRouting,
} from "../services/adminService";
import { getErrorMessage } from "../services/errorMessage";
import { useToast } from "../components/ToastProvider";

export default function AdminSettings() {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [organizationName, setOrganizationName] = useState("");
  const [status, setStatus] = useState("active");
  const [persistedStatus, setPersistedStatus] = useState("active");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [routingSaving, setRoutingSaving] = useState(false);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [teams, setTeams] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [routing, setRouting] = useState({
    enabled: false,
    default_team_id: "",
    low_risk_team_id: "",
    medium_risk_team_id: "",
    high_risk_team_id: "",
    review_stage: "RISK_REVIEW" as "OPERATIONS_REVIEW" | "RISK_REVIEW" | "CREDIT_COMMITTEE_REVIEW" | "FINAL_DECISION",
  });

  const loadSettings = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const [organizationResponse, routingResponse, teamsResponse] = await Promise.all([
        getOrganization(token),
        getRiskRouting(token),
        getTeams(token),
      ]);
        setLoadError(null);
        const org = organizationResponse.data ?? {};
        const configuredRouting = routingResponse.data?.risk_routing ?? {};
        setOrganizationName(org.organization_name ?? "");
        setStatus(org.status ?? "active");
        setPersistedStatus(org.status ?? "active");
        setRouting({
          enabled: configuredRouting.enabled ?? false,
          default_team_id: configuredRouting.default_team_id ?? "",
          low_risk_team_id: configuredRouting.low_risk_team_id ?? "",
          medium_risk_team_id: configuredRouting.medium_risk_team_id ?? "",
          high_risk_team_id: configuredRouting.high_risk_team_id ?? "",
          review_stage: configuredRouting.review_stage ?? "RISK_REVIEW",
        });
        setTeams(
          (teamsResponse.data ?? []).filter(
            (team: { id: string; name: string; status: string }) => team.status === "active"
          )
        );
    } catch (loadError) {
      setLoadError(getErrorMessage(loadError, "Unable to load settings."));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const retrySettings = () => {
    setLoading(true);
    setLoadError(null);
    void loadSettings();
  };

  const handleSave = async () => {
    if (!token) {
      return;
    }
    if (persistedStatus === "active" && status === "inactive" &&
      !window.confirm("Deactivate this organization? Users may lose access based on the platform's tenant-status policy.")) {
      return;
    }

    setSaving(true);
    try {
      await updateOrganization(token, {
        organization_name: organizationName,
        status,
      });
      const response = await getOrganization(token);
      setOrganizationName(response.data.organization_name ?? "");
      setStatus(response.data.status ?? "active");
      setPersistedStatus(response.data.status ?? "active");
      showToast("Saved successfully");
    } catch (error) {
      showToast(getErrorMessage(error, "Unable to save changes"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRouting = async () => {
    if (!token) {
      return;
    }

    setRoutingSaving(true);
    setRoutingError(null);
    try {
      await updateRiskRouting(token, {
        enabled: routing.enabled,
        default_team_id: routing.default_team_id || null,
        low_risk_team_id: routing.low_risk_team_id || null,
        medium_risk_team_id: routing.medium_risk_team_id || null,
        high_risk_team_id: routing.high_risk_team_id || null,
        review_stage: routing.review_stage,
      });
      const response = await getRiskRouting(token);
      const saved = response.data?.risk_routing ?? {};
      setRouting({
        enabled: saved.enabled ?? false,
        default_team_id: saved.default_team_id ?? "",
        low_risk_team_id: saved.low_risk_team_id ?? "",
        medium_risk_team_id: saved.medium_risk_team_id ?? "",
        high_risk_team_id: saved.high_risk_team_id ?? "",
        review_stage: saved.review_stage ?? "RISK_REVIEW",
      });
      showToast("Risk routing saved successfully");
    } catch (saveError) {
      setRoutingError(getErrorMessage(saveError, "Unable to save risk routing."));
    } finally {
      setRoutingSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Tenant Admin</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Settings</h1>
      </div>

      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{loadError}</span>
          <button type="button" onClick={retrySettings} disabled={loading} className="font-medium underline disabled:opacity-50">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">Loading settings…</div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                <UserCircle2 size={18} />
              </div>
              <h2 className="text-xl font-semibold text-slate-900">Organization</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Organization name</label>
                <input
                  required
                  minLength={2}
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Status</label>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || Boolean(loadError)}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                  <Shield size={18} />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">Security</h2>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                <p>Account authentication and session security are enforced by the backend.</p>
                <p>Authentication-factor settings are not configurable from this tenant workspace.</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                  <SlidersHorizontal size={18} />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">Preferences</h2>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                <p>Signed in as {user?.name ?? "admin"}.</p>
                <p>Current tenant: {user?.tenant_name ?? "Unassigned"}.</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                <SlidersHorizontal size={18} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Risk Routing</h2>
                <p className="text-sm text-slate-500">Route human reviews to tenant teams by risk level.</p>
              </div>
            </div>

            {routingError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {routingError}
              </div>
            )}

            <label className="mb-5 flex items-center gap-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={routing.enabled}
                onChange={(event) => setRouting((current) => ({ ...current, enabled: event.target.checked }))}
              />
              Enable risk-based routing
            </label>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Default team</label>
                <select
                  value={routing.default_team_id}
                  onChange={(event) => setRouting((current) => ({ ...current, default_team_id: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                >
                  <option value="">No default team</option>
                  {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Review stage</label>
                <select
                  value={routing.review_stage}
                  onChange={(event) => setRouting((current) => ({ ...current, review_stage: event.target.value as typeof current.review_stage }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                >
                  <option value="OPERATIONS_REVIEW">Operations review</option>
                  <option value="RISK_REVIEW">Risk review</option>
                  <option value="CREDIT_COMMITTEE_REVIEW">Credit committee review</option>
                  <option value="FINAL_DECISION">Final decision</option>
                </select>
              </div>
              {([
                ["LOW", "low_risk_team_id"],
                ["MEDIUM", "medium_risk_team_id"],
                ["HIGH", "high_risk_team_id"],
              ] as const).map(([risk, field]) => (
                <div key={field}>
                  <label className="mb-2 block text-sm font-medium text-slate-700">{risk} risk team</label>
                  <select
                    value={routing[field]}
                    onChange={(event) => setRouting((current) => ({ ...current, [field]: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  >
                    <option value="">Use default team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    {risk} → {teams.find((team) => team.id === routing[field])?.name ?? "default team"}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={handleSaveRouting}
                disabled={routingSaving || Boolean(loadError)}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {routingSaving ? "Saving…" : "Save Routing"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
