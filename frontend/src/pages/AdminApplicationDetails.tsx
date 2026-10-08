import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { getApplication } from "../services/adminService";
import { getErrorMessage } from "../services/errorMessage";

interface ApplicationDetailsRecord {
  id: string;
  reference_code: string;
  applicant_name: string;
  applicant_email?: string | null;
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
  status: string;
  governance_status?: string | null;
  assigned_team_name?: string | null;
  current_workflow_stage?: string | null;
  governance_result?: Record<string, any> | null;
  routing_mode?: string | null;
  risk_level?: string | null;
  review_status?: string | null;
}

const displayValue = (value: unknown) => value === null || value === undefined || value === "" ? "Not available" : String(value);

export default function AdminApplicationDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [application, setApplication] = useState<ApplicationDetailsRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !id) {
      setLoading(false);
      setError("Application not found or you do not have access to this application.");
      return;
    }

    void getApplication(token, id)
      .then((response) => setApplication(response.data))
      .catch((loadError) => {
        setApplication(null);
        if (loadError?.response?.status === 403 || loadError?.response?.status === 404) {
          setError("Application not found or you do not have access to this application.");
        } else {
          setError(getErrorMessage(loadError, "Unable to load application details."));
        }
      })
      .finally(() => setLoading(false));
  }, [id, token]);

  if (loading) {
    return <div className="flex items-center justify-center rounded-xl border bg-white p-12 text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading application details...</div>;
  }

  if (error || !application) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => navigate("/admin/applications")} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={18} /> Back to Applications
        </button>
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5" />
          <span>{error ?? "Application not found or you do not have access to this application."}</span>
        </div>
      </div>
    );
  }

  const governance = application.governance_result ?? {};
  const decision = governance.decision ?? {};
  const explainability = governance.explainability ?? {};

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => navigate("/admin/applications")} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={18} /> Back to Applications
      </button>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <p className="text-sm text-slate-500">Application</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{application.reference_code}</h1>
            <p className="mt-1 text-slate-600">{application.applicant_name}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">{application.status}</span>
            {application.routing_mode === "RISK_BASED_SINGLE_REVIEW" ? (
              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">Risk-based single review</span>
            ) : (
              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">{application.current_workflow_stage ?? "No workflow stage"}</span>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Detail label="Applicant email" value={application.applicant_email} />
          <Detail label="Loan type" value={application.loan_type} />
          <Detail label="Loan amount" value={application.loan_amount} />
          <Detail label="Tenure" value={application.loan_tenure_months ? `${application.loan_tenure_months} months` : null} />
          <Detail label="Purpose" value={application.loan_purpose} />
          <Detail label="Monthly income" value={application.monthly_income} />
          <Detail label="Employment" value={application.employment_years ? `${application.employment_type ?? "Not specified"} (${application.employment_years} years)` : application.employment_type} />
          <Detail label="Credit score" value={application.credit_score} />
          <Detail label="Existing EMI" value={application.existing_monthly_emi} />
          <Detail label="DTI" value={application.debt_to_income} />
          <Detail label="Assigned team" value={application.assigned_team_name} />
          {application.routing_mode === "RISK_BASED_SINGLE_REVIEW" && <><Detail label="Risk" value={application.risk_level} /><Detail label="Review" value={application.review_status ?? "PENDING"} /></>}
          <Detail label="AI governance status" value={application.governance_status} />
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">AI Governance Evaluation</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Detail label="Prediction" value={decision.original_prediction} />
          <Detail label="Probability / confidence" value={decision.model_probability} />
          <Detail label="Risk" value={governance.risk?.level} />
          <Detail label="Policy compliance" value={governance.policy_compliance?.status} />
          <Detail label="Fairness result" value={governance.fairness?.status} />
          <Detail label="Decision" value={decision.final_decision} />
          <Detail label="Routing reason" value={decision.reason} />
        </div>

        <JsonSection label="Explainability / SHAP" value={explainability.top_features} />
        <JsonSection label="Policy checks" value={governance.policy_compliance?.checks ?? governance.policy_compliance?.violations} />
        <JsonSection label="Decision trace" value={governance.trace} />
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: unknown }) {
  return <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-800">{displayValue(value)}</p></div>;
}

function JsonSection({ label, value }: { label: string; value: unknown }) {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  return <div className="mt-5"><h3 className="text-sm font-medium text-slate-700">{label}</h3><pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(value, null, 2)}</pre></div>;
}