import api from "./api";

export const governanceService = {
  async evaluate(applicationData: unknown) {
    const response = await api.post(
      "/api/v1/governance/evaluate",
      applicationData
    );

    return response.data;
  },

  async getApplication(id: string) {
    const response = await api.get(
      `/api/v1/governance/applications/${id}`
    );

    return response.data;
  },
};