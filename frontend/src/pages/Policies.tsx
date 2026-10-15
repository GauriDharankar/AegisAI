import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ToastProvider";
import { getErrorMessage } from "../services/errorMessage";
import {
  createPolicy,
  deletePolicy,
  getPolicies,
  updatePolicy,
} from "../services/policyService";
import type {
  Policy,
  PolicyAction,
  PolicyOperator,
  PolicyPayload,
  PolicySeverity,
} from "../services/policyService";

type PolicyFormValues = Omit<PolicyPayload, "value"> & { value: string };

const EMPTY_FORM: PolicyFormValues = {
  name: "",
  description: "",
  enabled: true,
  field: "",
  operator: ">=",
  value: "",
  action: "REVIEW",
  severity: "MEDIUM",
};

function parsePolicyValue(value: string): number | string | boolean {
  const trimmed = value.trim();
  if (trimmed.toLowerCase() === "true") return true;
  if (trimmed.toLowerCase() === "false") return false;
  if (trimmed !== "" && Number.isFinite(Number(trimmed))) return Number(trimmed);
  return trimmed;
}

function policyPayload(form: PolicyFormValues): PolicyPayload {
  return { ...form, name: form.name.trim(), field: form.field.trim(), value: parsePolicyValue(form.value) };
}

function toFormValues(policy: Policy): PolicyFormValues {
  return {
    name: policy.name,
    description: policy.description ?? "",
    enabled: policy.enabled,
    field: policy.field ?? "",
    operator: policy.operator ?? ">=",
    value: policy.value === null ? "" : String(policy.value),
    action: policy.action ?? "REVIEW",
    severity: policy.severity ?? "MEDIUM",
  };
}

export default function Policies() {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<PolicyFormValues>(EMPTY_FORM);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingPolicyId, setDeletingPolicyId] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const canManagePolicies = user?.role === "MANAGER";

  useEffect(() => {
    let active = true;
    setPolicies([]);
    setLoading(true);
    setError(null);

    if (!token) {
      setError("Your session has expired. Sign in again to load policies.");
      setLoading(false);
      return () => {
        active = false;
      };
    }

    void getPolicies(token)
      .then((response) => {
        if (active) setPolicies(response.data);
      })
      .catch((loadError: unknown) => {
        if (active) setError(getErrorMessage(loadError, "Unable to load policies."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token, loadAttempt]);

  const filteredPolicies = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return policies;
    return policies.filter((policy) =>
      [policy.name, policy.code, policy.description ?? "", policy.field ?? ""]
        .some((part) => part.toLowerCase().includes(query)),
    );
  }, [policies, search]);

  const enabledPolicies = policies.filter((policy) => policy.enabled).length;
  const highSeverity = policies.filter((policy) => policy.severity === "HIGH" || policy.severity === "CRITICAL").length;

  const openCreateForm = () => {
    setEditingPolicy(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
    setError(null);
  };

  const openEditForm = (policy: Policy) => {
    setEditingPolicy(policy);
    setForm(toFormValues(policy));
    setIsFormOpen(true);
    setError(null);
  };

  const closeForm = () => {
    if (!saving) {
      setEditingPolicy(null);
      setForm(EMPTY_FORM);
      setIsFormOpen(false);
    }
  };

  const updateForm = <K extends keyof PolicyFormValues>(key: K, value: PolicyFormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setError("Your session has expired. Sign in again to save policy changes.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = policyPayload(form);
      const response = editingPolicy
        ? await updatePolicy(token, editingPolicy.id, payload)
        : await createPolicy(token, payload);
      const savedPolicy = response.data;
      setPolicies((current) =>
        editingPolicy
          ? current.map((policy) => policy.id === savedPolicy.id ? savedPolicy : policy)
          : [...current, savedPolicy],
      );
      setEditingPolicy(null);
      setForm(EMPTY_FORM);
      setIsFormOpen(false);
      showToast(editingPolicy ? "Policy updated successfully" : "Policy created successfully");
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Unable to save policy changes."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (policy: Policy) => {
    if (!window.confirm(`Delete "${policy.name}"? This cannot be undone.`)) return;
    if (!token) {
      setError("Your session has expired. Sign in again to delete policies.");
      return;
    }

    setDeletingPolicyId(policy.id);
    setError(null);
    try {
      await deletePolicy(token, policy.id);
      setPolicies((current) => current.filter((item) => item.id !== policy.id));
      showToast("Policy deleted successfully");
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Unable to delete policy."));
    } finally {
      setDeletingPolicyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-blue-600">Governance</p>
          <h1 className="text-2xl font-bold text-slate-800">Policies</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage tenant-specific AI governance and decision policies.
          </p>
        </div>
        {canManagePolicies && (
          <button type="button" onClick={openCreateForm} className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700">
            <Plus size={18} />
            Add Policy
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          {!loading && (
            <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)} className="shrink-0 font-medium underline">
              Retry
            </button>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Total Policies</p><p className="mt-2 text-2xl font-bold text-slate-800">{policies.length}</p></div>
            <div className="rounded-lg bg-blue-100 p-3 text-blue-600"><ShieldCheck size={22} /></div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Enabled Policies</p><p className="mt-2 text-2xl font-bold text-slate-800">{enabledPolicies}</p></div>
            <div className="rounded-lg bg-green-100 p-3 text-green-600"><CheckCircle2 size={22} /></div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">High Severity</p><p className="mt-2 text-2xl font-bold text-slate-800">{highSeverity}</p></div>
            <div className="rounded-lg bg-red-100 p-3 text-red-600"><AlertTriangle size={22} /></div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="relative max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search policies..."
            aria-label="Search policies"
            className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-6 py-5">
          <h2 className="font-semibold text-slate-800">Tenant Policies</h2>
          <p className="mt-1 text-sm text-slate-500">{user?.tenant_name ?? "Current organization"} governance rules</p>
        </div>
        {loading ? (
          <div role="status" className="p-6 text-sm text-slate-500">Loading policies...</div>
        ) : filteredPolicies.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            {policies.length === 0 ? "No policies yet. Add a policy to configure tenant governance rules." : "No policies match your search."}
          </div>
        ) : (
          <div className="divide-y">
            {filteredPolicies.map((policy) => (
              <div key={policy.id} className="p-6 transition hover:bg-slate-50">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-semibold text-slate-800">{policy.name}</h3>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">{policy.code}</span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${policy.enabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {policy.enabled ? "ENABLED" : "DISABLED"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{policy.description || "No description provided."}</p>
                    {policy.field && policy.operator && (
                      <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 font-mono text-sm text-white">
                        <span>{policy.field}</span><span className="text-blue-300">{policy.operator}</span><span>{String(policy.value ?? "")}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div><p className="text-xs text-slate-400">ACTION</p><p className="mt-1 text-sm font-semibold text-slate-700">{policy.action ?? "—"}</p></div>
                    <div>
                      <p className="text-xs text-slate-400">SEVERITY</p>
                      <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${policy.severity === "HIGH" || policy.severity === "CRITICAL" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {policy.severity ?? "—"}
                      </span>
                    </div>
                    {canManagePolicies && (
                      <div className="flex gap-2">
                        <button type="button" aria-label={`Edit ${policy.name}`} onClick={() => openEditForm(policy)} className="rounded-lg border p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
                          <Pencil size={17} />
                        </button>
                        <button type="button" aria-label={`Delete ${policy.name}`} onClick={() => void handleDelete(policy)} disabled={deletingPolicyId === policy.id} className="rounded-lg border p-2 text-red-500 transition hover:bg-red-50 disabled:opacity-50">
                          <Trash2 size={17} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isFormOpen && canManagePolicies && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="policy-form-title" className="my-8 w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b px-6 py-5">
              <div>
                <h2 id="policy-form-title" className="text-lg font-semibold text-slate-800">{editingPolicy ? "Edit Policy" : "Add Policy"}</h2>
                <p className="mt-1 text-sm text-slate-500">Configure the rule applied during tenant governance evaluation.</p>
              </div>
              <button type="button" onClick={closeForm} aria-label="Close policy form" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <form onSubmit={(event) => void handleSave(event)} className="space-y-4 p-6">
              {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Policy name
                  <input required minLength={1} maxLength={255} value={form.name} onChange={(event) => updateForm("name", event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-normal outline-none focus:border-blue-500" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Field
                  <input required maxLength={120} value={form.field} onChange={(event) => updateForm("field", event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-normal outline-none focus:border-blue-500" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Operator
                  <select value={form.operator} onChange={(event) => updateForm("operator", event.target.value as PolicyOperator)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-normal">
                    {([">", ">=", "<", "<=", "==", "!="] as PolicyOperator[]).map((operator) => <option key={operator}>{operator}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Required value
                  <input required value={form.value} onChange={(event) => updateForm("value", event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-normal outline-none focus:border-blue-500" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Action
                  <select value={form.action} onChange={(event) => updateForm("action", event.target.value as PolicyAction)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-normal">
                    {(["APPROVE", "REJECT", "REVIEW", "FLAG"] as PolicyAction[]).map((action) => <option key={action}>{action}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Severity
                  <select value={form.severity} onChange={(event) => updateForm("severity", event.target.value as PolicySeverity)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-normal">
                    {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as PolicySeverity[]).map((severity) => <option key={severity}>{severity}</option>)}
                  </select>
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Description
                <textarea rows={3} value={form.description} onChange={(event) => updateForm("description", event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-normal outline-none focus:border-blue-500" />
              </label>
              <label className="flex items-center gap-3 text-sm text-slate-700">
                <input type="checkbox" checked={form.enabled} onChange={(event) => updateForm("enabled", event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                Enable this policy
              </label>
              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={closeForm} disabled={saving} className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Saving..." : editingPolicy ? "Save Changes" : "Create Policy"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
