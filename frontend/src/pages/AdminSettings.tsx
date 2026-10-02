import { useEffect, useState } from "react";
import { Shield, SlidersHorizontal, UserCircle2 } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { getOrganization, updateOrganization } from "../services/adminService";

export default function AdminSettings() {
  const { token, user } = useAuth();
  const [organizationName, setOrganizationName] = useState("");
  const [status, setStatus] = useState("active");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      return;
    }

    getOrganization(token)
      .then((response) => {
        const org = response.data ?? {};
        setOrganizationName(org.organization_name ?? "");
        setStatus(org.status ?? "active");
      })
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
    } finally {
      setSaving(false);
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
        </div>
      )}
    </div>
  );
}
