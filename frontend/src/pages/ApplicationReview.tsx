import { useEffect, useState } from "react";
import { ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { reviewService, type ReviewerApplication } from "../services/reviewService";
import { getErrorMessage } from "../services/errorMessage";
import { useToast } from "../components/ToastProvider";

export default function ApplicationReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { showToast } = useToast();

  const [application, setApplication] = useState<ReviewerApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState<string | null>(null);
  const [decision, setDecision] = useState<"approved" | "rejected" | "pending">("pending");
  const [comments, setComments] = useState("");
  const [finalDecision, setFinalDecision] = useState<"approved" | "rejected">("approved");
  const [submitting, setSubmitting] = useState(false);

  const loadApplication = async () => {
    if (!token || !id) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await reviewService.getApplication(token, id);
      setApplication(data);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Unable to load application details."));
      setApplication(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadApplication();
  }, [id, token]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!token || !id) {
      return;
    }

    setSubmitting(true);
    setSubmissionError(null);
    setSubmissionSuccess(null);

    try {
      if (application?.current_workflow_stage === "FINAL_DECISION") {
        await reviewService.submitFinalDecision(token, id, {
          decision: finalDecision,
          comments: comments.trim() || undefined,
        });

        showToast("Final decision saved successfully");
      } else {
        await reviewService.submitReview(token, id, {
          status: isRiskBased ? finalDecision : decision,
          comments: comments.trim() || undefined,
        });

        showToast("Review submitted successfully");
      }

      setSubmissionSuccess("Review submitted successfully.");
      setComments("");
      setDecision("pending");
      setFinalDecision("approved");

      try {
        const refreshed = await reviewService.getApplication(token, id);
        setApplication(refreshed);
      } catch {
        navigate("/reviews", { replace: true });
      }
    } catch (submitError) {
      setSubmissionError(getErrorMessage(submitError, "Review submission failed."));
    } finally {
      setSubmitting(false);
    }
  };

  if (!id) {
    return <div className="rounded-xl border bg-white p-6 text-slate-500">Application not found.</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border bg-white p-12 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading application details...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate("/reviews")}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={18} />
          Back to Review Queue
        </button>

        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="rounded-xl border bg-white p-6 text-slate-500">
        Application not found.
      </div>
    );
  }

  const isRiskBased = application.routing_mode === "RISK_BASED_SINGLE_REVIEW";

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/reviews")}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={18} />
        Back to Review Queue
      </button>

      <div className="rounded-xl border bg-white p-6">
        <div className="flex flex-col justify-between gap-5 md:flex-row">
          <div>
            <p className="text-sm text-slate-500">Application</p>
            <h1 className="text-2xl font-bold">{application.reference_code}</h1>
            <p className="mt-1 text-slate-500">{application.applicant_name}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700">
              {isRiskBased ? "Risk-based single review" : application.current_workflow_stage ?? "Unassigned stage"}
            </span>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
              {application.assigned_team_name ?? "Unassigned team"}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {!isRiskBased && <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Workflow</p>
            <p className="mt-1 font-semibold">{application.workflow_name ?? "Not available"}</p>
          </div>}

          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Applicant email</p>
            <p className="mt-1 font-semibold">{application.applicant_email ?? "Not provided"}</p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Status</p>
            <p className="mt-1 font-semibold">{application.status}</p>
          </div>
          {isRiskBased && <><div className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">Risk</p><p className="mt-1 font-semibold">{application.risk_level ?? "Unknown"}</p></div><div className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">Review</p><p className="mt-1 font-semibold">{application.review_status ?? "PENDING"}</p></div></>}

          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Created</p>
            <p className="mt-1 font-semibold">{new Date(application.created_at).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold">AI Governance Evaluation</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">Governance status</p><p className="mt-1 font-semibold">{application.governance_status ?? "Not evaluated"}</p></div>
          <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">AI risk</p><p className="mt-1 font-semibold">{application.governance_result?.risk?.level ?? "Unknown"}</p></div>
          <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">Model result</p><p className="mt-1 font-semibold">{application.governance_result?.decision?.original_prediction ?? "Unknown"}</p></div>
          <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">Policy compliance</p><p className="mt-1 font-semibold">{application.governance_result?.policy_compliance?.status ?? "Unknown"}</p></div>
          <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">Fairness</p><p className="mt-1 font-semibold">{application.governance_result?.fairness?.status ?? "Unknown"}</p></div>
          <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">Governance decision</p><p className="mt-1 font-semibold">{application.governance_result?.decision?.final_decision ?? "Unknown"}</p></div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div><p className="text-sm font-medium text-slate-700">Financial information</p><p className="mt-2 text-sm text-slate-600">{application.loan_type} loan · {application.loan_purpose} · Amount {application.loan_amount} · Tenure {application.loan_tenure_months} months</p><p className="text-sm text-slate-600">Income {application.monthly_income} · Credit score {application.credit_score} · Existing EMI {application.existing_monthly_emi} · DTI {application.debt_to_income?.toFixed(2)}</p></div>
          <div><p className="text-sm font-medium text-slate-700">Key factors</p><div className="mt-2 flex flex-wrap gap-2">{(application.governance_result?.explainability?.top_features ?? []).slice(0, 5).map((factor) => <span key={factor.feature} className="rounded-full bg-blue-100 px-2.5 py-1 text-xs text-blue-700">{factor.feature}: {factor.direction}</span>)}</div></div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold">
          {application.current_workflow_stage === "FINAL_DECISION" ? "Final Decision" : "Human Review"}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          {isRiskBased
            ? "Provide the final reviewer outcome and notes for this application."
            : application.current_workflow_stage === "FINAL_DECISION"
            ? "Provide the final approval or rejection for this application."
            : "Provide the reviewer outcome and notes for the current workflow stage."}
        </p>

        {submissionError && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <span>{submissionError}</span>
          </div>
        )}

        {submissionSuccess && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {submissionSuccess}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              {isRiskBased || application.current_workflow_stage === "FINAL_DECISION" ? "Final decision" : "Decision"}
            </label>
            <select
              value={isRiskBased || application.current_workflow_stage === "FINAL_DECISION" ? finalDecision : decision}
              onChange={(event) => {
                const nextValue = event.target.value;
                if (isRiskBased || application.current_workflow_stage === "FINAL_DECISION") {
                  setFinalDecision(nextValue as "approved" | "rejected");
                } else {
                  setDecision(nextValue as "approved" | "rejected" | "pending");
                }
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {isRiskBased || application.current_workflow_stage === "FINAL_DECISION" ? (
                <>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </>
              ) : (
                <>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="pending">Pending</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Comments / notes</label>
            <textarea
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              rows={5}
              placeholder={
                isRiskBased || application.current_workflow_stage === "FINAL_DECISION"
                  ? "Add final decision rationale..."
                  : "Add reviewer notes..."
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting || application.status === "completed"}
              className="rounded-lg bg-blue-600 px-5 py-3 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {submitting ? "Submitting..." : application.status === "completed" ? "Application Finalized" : isRiskBased ? "Submit Final Review" : application.current_workflow_stage === "FINAL_DECISION" ? "Submit Final Decision" : "Submit Review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}