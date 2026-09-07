import api from "./api";
import LoanApplication from "../types";

export const reviewService = {
  async getPendingReviews(): Promise<LoanApplication[]> {
    const response = await api.get("/governance/reviews/pending");
    return response.data;
  },

  async getApplication(id: string): Promise<LoanApplication> {
    const response = await api.get(`/governance/reviews/${id}`);
    return response.data;
  },

  async overrideDecision(
    id: string,
    decision: string,
    reason: string
  ) {
    const response = await api.post(
      `/governance/reviews/${id}/override`,
      {
        decision,
        reason,
      }
    );

    return response.data;
  },
};