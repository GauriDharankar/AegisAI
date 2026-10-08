import { useEffect, useState } from "react";
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
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [routingSaving, setRoutingSaving] = useState(false);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [teams, setTeams] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [routing, setRouting] = useState({
    enabled: false,
    low_risk_team_id: "",
    medium_risk_team_id: "",
    high_risk_team_id: "",
  });

  useEffect(() => {
    if (!token) {
      return;
    }

    Promise.all([getOrganization(token), getRiskRouting(token), getTeams(token)])
      .then(([organizationResponse, routingResponse, teamsResponse]) => {
        const org = organizationResponse.data ?? {};
        const configuredRouting = routingResponse.data?.risk_routing ?? {};
        setOrganizationName(org.organization_name ?? "");
        setStatus(org.status ?? "active");
        setRouting({
          enabled: configuredRouting.enabled ?? false,
          low_risk_team_id: configuredRouting.low_risk_team_id ?? "",
          medium_risk_team_id: configuredRouting.medium_risk_team_id ?? "",
          high_risk_team_id: configuredRouting.high_risk_team_id ?? "",
        });
        setTeams(
          (teamsResponse.data ?? []).filter(
            (team: { id: string; name: string; status: string }) => team.status === "active"
          )
        );
      })
      .catch((loadError) => setRoutingError(getErrorMessage(loadError, "Unable to load settings.")))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async () => {
    if (!token) {
      return;
    }

    setSaving(true);
    try {
      await updateOrganization(token, {
        organization_name: organizationName,
        status,
      });
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
        low_risk_team_id: routing.low_risk_team_id || null,
        medium_risk_team_id: routing.medium_risk_team_id || null,
        high_risk_team_id: routing.high_risk_team_id || null,
        review_stage: "RISK_REVIEW",
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
                disabled={saving}
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
                <p>Two-factor authentication is enabled for admin accounts.</p>
                <p>Session security remains enforced by the backend authentication layer.</p>
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

            <div className="grid gap-4 md:grid-cols-3">
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
                disabled={routingSaving}
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
