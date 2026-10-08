import api from "./api";

export interface ReviewerApplication {
  id: string;
  tenant_id: string;
  workflow_id?: string | null;
  workflow_name?: string | null;
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
  routing_mode?: string | null;
  risk_level?: string | null;
  review_status?: string | null;
  governance_result?: {
    risk?: { level?: string };
    decision?: { original_prediction?: string; model_probability?: number; reason?: string; final_decision?: string };
    policy_compliance?: { status?: string; violations?: unknown[]; checks?: unknown[] };
    fairness?: { status?: string; message?: string };
    explainability?: { top_features?: Array<{ feature: string; impact: number; direction: string }> };
  } | null;
}

export interface ReviewSubmitPayload {
  status: "approved" | "rejected" | "pending";
  comments?: string;
}

export interface ReviewSubmitResult {
  id: string;
  application_id: string;
  workflow_stage?: string | null;
  status: string;
  comments?: string | null;
  created_at: string;
  next_stage?: string | null;
  next_team_id?: string | null;
  finalized?: boolean;
  decision?: "approved" | "rejected";
  decision_id?: string;
  blockchain?: {
    success: boolean;
    status?: string;
    message?: string;
  };
}

export interface FinalDecisionSubmitResult {
  id: string;
  application_id: string;
  decision: "approved" | "rejected";
  comments?: string | null;
  decision_maker_id: string;
  workflow_stage: string;
  status: string;
  created_at: string;
}

export const reviewService = {
  async getPendingReviews(token: string): Promise<ReviewerApplication[]> {
    const response = await api.get("/api/v1/reviewer/applications", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data ?? [];
  },

  async getApplication(token: string, id: string): Promise<ReviewerApplication> {
    const response = await api.get(`/api/v1/reviewer/applications/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  },

  async submitReview(
    token: string,
    id: string,
    payload: ReviewSubmitPayload
  ): Promise<ReviewSubmitResult> {
    const response = await api.post(
      `/api/v1/reviewer/applications/${id}/reviews`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  },

  async submitFinalDecision(
    token: string,
    id: string,
    payload: { decision: "approved" | "rejected"; comments?: string }
  ): Promise<FinalDecisionSubmitResult> {
    const response = await api.post(
      `/api/v1/reviewer/applications/${id}/final-decision`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  },
};