import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, FolderOpen, Loader2, Plus } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { getTeams } from "../services/adminService";
import api from "../services/api";
import { getErrorMessage } from "../services/errorMessage";

interface ApplicationRecord {
  id: string;
  tenant_id: string;
  reference_code: string;
  applicant_name: string;
  applicant_email?: string | null;
  status: string;
  current_workflow_stage?: string | null;
  current_workflow_stage_id?: string | null;
  assigned_team_id?: string | null;
  assigned_team_name?: string | null;
  created_at: string;
  updated_at: string;
  loan_type?: string | null;
  loan_amount?: number | null;
  loan_tenure_months?: number | null;
  loan_purpose?: string | null;
  monthly_income?: number | null;
  employment_type?: string | null;
  employment_years?: number | null;
  credit_score?: number | null;
  existing_monthly_emi?: number | null;
  debt_to_income?: number | null;
  governance_status?: string | null;
  governance_result?: any;
}

interface TeamOption {
  id: string;
  name: string;
  status?: string;
}

const emptyForm = {
  reference_code: "",
  applicant_name: "",
  applicant_email: "",
  team_id: "",
  loan_type: "personal",
  loan_amount: "300000",
  loan_tenure_months: "60",
  loan_purpose: "general",
  monthly_income: "75000",
  employment_type: "salaried",
  employment_years: "5",
  credit_score: "700",
  existing_monthly_emi: "15000",
};

export default function AdminApplications() {
  const { token } = useAuth();
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadTeams = async () => {
    if (!token) {
      return;
    }

    try {
      const response = await getTeams(token);
      setTeams(response.data ?? []);
    } catch (teamError) {
      setError(getErrorMessage(teamError, "Unable to load teams."));
      setTeams([]);
    }
  };

  const loadApplications = async () => {
    if (!token) {
      return;
    }

    try {
      setError(null);
      const response = await api.get("/api/v1/applications", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setApplications(response.data ?? []);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Unable to load applications."));
      setApplications([]);
    }
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setApplications([]);
      setTeams([]);
      return;
    }

    const fetchInitialData = async () => {
      setLoading(true);
      await Promise.all([loadTeams(), loadApplications()]);
      setLoading(false);
    };

    void fetchInitialData();
  }, [token]);

  const handleChange = (field: keyof typeof emptyForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!token) {
      return;
    }

    if (!form.reference_code.trim() || !form.applicant_name.trim()) {
      setError("Reference code and applicant name are required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await api.post(
        "/api/v1/applications",
        {
          reference_code: form.reference_code.trim(),
          applicant_name: form.applicant_name.trim(),
          applicant_email: form.applicant_email.trim() || undefined,
          team_id: form.team_id || undefined,
          loan_type: form.loan_type.trim(),
          loan_amount: Number(form.loan_amount),
          loan_tenure_months: Number(form.loan_tenure_months),
          loan_purpose: form.loan_purpose.trim(),
          monthly_income: Number(form.monthly_income),
          employment_type: form.employment_type.trim(),
          employment_years: Number(form.employment_years),
          credit_score: Number(form.credit_score),
          existing_monthly_emi: Number(form.existing_monthly_emi),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setForm(emptyForm);
      setSuccessMessage("Application created successfully.");
      await Promise.all([loadApplications(), loadTeams()]);
    } catch (createError) {
      setError(getErrorMessage(createError, "Unable to create the application."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Tenant Admin</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Applications / Cases</h1>
      </div>

      <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
            <Plus size={18} />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Create application</h2>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <CheckCircle2 size={16} className="mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Reference code</label>
            <input
              value={form.reference_code}
              onChange={(event) => handleChange("reference_code", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="APP-1001"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Loan type</label>
            <input value={form.loan_type} onChange={(event) => handleChange("loan_type", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Loan amount</label>
            <input type="number" min="1" value={form.loan_amount} onChange={(event) => handleChange("loan_amount", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Tenure (months)</label>
            <input type="number" min="1" value={form.loan_tenure_months} onChange={(event) => handleChange("loan_tenure_months", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Loan purpose</label>
            <input value={form.loan_purpose} onChange={(event) => handleChange("loan_purpose", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Monthly income</label>
            <input type="number" min="1" value={form.monthly_income} onChange={(event) => handleChange("monthly_income", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Employment type</label>
            <input value={form.employment_type} onChange={(event) => handleChange("employment_type", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Employment years</label>
            <input type="number" min="0" step="0.1" value={form.employment_years} onChange={(event) => handleChange("employment_years", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Credit score</label>
            <input type="number" min="300" max="850" value={form.credit_score} onChange={(event) => handleChange("credit_score", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Existing monthly EMI</label>
            <input type="number" min="0" value={form.existing_monthly_emi} onChange={(event) => handleChange("existing_monthly_emi", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Applicant name</label>
            <input
              value={form.applicant_name}
              onChange={(event) => handleChange("applicant_name", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Jane Borrower"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Applicant email</label>
            <input
              type="email"
              value={form.applicant_email}
              onChange={(event) => handleChange("applicant_email", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="jane@example.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Assigned team</label>
            <select
              value={form.team_id}
              onChange={(event) => handleChange("team_id", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">No team assigned</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting || !token}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {submitting ? "Creating..." : "Create application"}
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">Application list</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            {applications.length} {applications.length === 1 ? "record" : "records"}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-600">
            <Loader2 size={16} className="animate-spin" />
            Loading applications…
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <div className="mb-4 rounded-full bg-slate-200 p-4 text-slate-700">
              <FolderOpen size={28} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">No applications created yet</h3>
            <p className="mt-2 max-w-md text-sm text-slate-500">
              Use the form above to create the first application for this tenant.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {applications.map((application) => (
              <div key={application.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{application.reference_code}</p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-900">{application.applicant_name}</h3>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    {application.status}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <div>
                    <span className="font-medium text-slate-700">Application ID:</span> {application.id}
                  </div>
                  <div>
                    <span className="font-medium text-slate-700">Applicant:</span> {application.applicant_email || "No email recorded"}
                  </div>
                  <div>
                    <span className="font-medium text-slate-700">Assigned team:</span> {application.assigned_team_name || "Unassigned"}
                  </div>
                  <div>
                    <span className="font-medium text-slate-700">Stage:</span> {application.current_workflow_stage || "Not assigned"}
                  </div>
                  <div><span className="font-medium text-slate-700">AI governance:</span> {application.governance_status || "Not evaluated"}</div>
                  <div><span className="font-medium text-slate-700">Risk:</span> {application.governance_result?.risk?.level || "Not evaluated"}</div>
                  <div>
                    <span className="font-medium text-slate-700">Created:</span> {new Date(application.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
