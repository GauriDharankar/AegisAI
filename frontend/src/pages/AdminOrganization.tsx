import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { getOrganization, updateOrganization } from "../services/adminService";

export default function AdminOrganization() {
  const { token } = useAuth();
  const [organization, setOrganization] = useState<any>(null);
  const [form, setForm] = useState({ organization_name: "", status: "active" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadOrganization = async () => {
    if (!token) {
      return;
    }

    const response = await getOrganization(token);
    const next = response.data;
    setOrganization(next);
    setForm({
      organization_name: next.organization_name ?? "",
      status: next.status ?? "active",
    });
  };

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadOrganization().finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      return;
    }

    setSaving(true);
    try {
      await updateOrganization(token, form);
      await loadOrganization();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">Loading organization…</div>;
  }

  if (!organization) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">No organization profile found.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Tenant Admin</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Organization</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
              <Building2 size={18} />
            </div>
            <h2 className="text-xl font-semibold text-slate-900">Organization details</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Organization name</p>
              <p className="mt-2 font-semibold text-slate-900">{organization.organization_name}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Status</p>
              <p className="mt-2 font-semibold text-slate-900">{organization.status}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Tenant ID</p>
              <p className="mt-2 font-semibold text-slate-900">{organization.id}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Users</p>
              <p className="mt-2 font-semibold text-slate-900">{organization.user_count}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4 md:col-span-2">
              <p className="text-sm text-slate-500">Created date</p>
              <p className="mt-2 font-semibold text-slate-900">{new Date(organization.created_at).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Edit organization</h2>
          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Organization name</label>
              <input
                value={form.organization_name}
                onChange={(event) => setForm((current) => ({ ...current, organization_name: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Status</label>
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save organization"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
