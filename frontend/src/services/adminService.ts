import api from "./api";

export async function getOrganization(token: string) {
  return api.get("/api/v1/admin/organization", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getConfiguration(token: string) {
  return api.get("/api/v1/admin/configuration", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function updateConfiguration(token: string, payload: {
  auto_approve: {
    enabled: boolean;
    minimum_probability: number;
    maximum_risk: "LOW" | "MEDIUM" | "HIGH";
    eligible_loan_types: string[];
    require_policy_compliance: boolean;
    require_fairness_pass: boolean;
  };
}) {
  return api.put("/api/v1/admin/configuration", payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function updateOrganization(
  token: string,
  payload: { organization_name?: string; status?: string }
) {
  return api.put("/api/v1/admin/organization", payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getTeams(token: string) {
  return api.get("/api/v1/admin/teams", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function updateTeam(
  token: string,
  teamId: string,
  payload: { name?: string; description?: string; status?: string }
) {
  return api.put(`/api/v1/admin/teams/${teamId}`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getApplications(token: string) {
  return api.get("/api/v1/applications", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getRiskRouting(token: string) {
  return api.get("/api/v1/admin/risk-routing", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function updateRiskRouting(token: string, payload: {
  enabled: boolean;
  default_team_id?: string | null;
  low_risk_team_id?: string | null;
  medium_risk_team_id?: string | null;
  high_risk_team_id?: string | null;
  review_stage?: "OPERATIONS_REVIEW" | "RISK_REVIEW" | "CREDIT_COMMITTEE_REVIEW" | "FINAL_DECISION";
}) {
  return api.put("/api/v1/admin/risk-routing", payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getReviewReminders(token: string) {
  return api.get("/api/v1/admin/review-reminders", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function updateReviewReminders(
  token: string,
  payload: { enabled: boolean; interval_minutes: 15 | 30 | 60 | 120 }
) {
  return api.put("/api/v1/admin/review-reminders", payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function createTeam(token: string, payload: { name: string; description?: string; status?: string }) {
  return api.post("/api/v1/admin/teams", payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getUsers(token: string) {
  return api.get("/api/v1/admin/users", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function updateUserStatus(token: string, userId: string, status: string) {
  return api.patch(`/api/v1/admin/users/${userId}/status`, { status }, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function assignUserTeam(
  token: string,
  userId: string,
  payload: { team_id: string; role?: string }
) {
  return api.post(`/api/v1/admin/users/${userId}/teams`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function removeUserTeam(token: string, userId: string, teamId: string) {
  return api.delete(`/api/v1/admin/users/${userId}/teams/${teamId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getWorkflow(token: string) {
  return api.get("/api/v1/admin/workflow", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getApplication(token: string, applicationId: string) {
  return api.get(`/api/v1/applications/${applicationId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function updateWorkflow(token: string, payload: {
  name?: string;
  status?: string;
  stages?: Array<{
    stage_type: string;
    team_id?: string | null;
    status?: string;
    stage_order?: number;
  }>;
}) {
  return api.put("/api/v1/admin/workflow", payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function createUser(token: string, payload: {
  name: string;
  email: string;
  password: string;
  status?: string;
  responsibilities?: string[];
  team_ids?: string[];
}) {
  return api.post("/api/v1/admin/users", payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function updateUser(
  token: string,
  userId: string,
  payload: { name?: string; email?: string }
) {
  return api.patch(`/api/v1/admin/users/${userId}`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function assignUserResponsibility(
  token: string,
  userId: string,
  payload: { responsibility: string }
) {
  return api.post(`/api/v1/admin/users/${userId}/responsibilities`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getAuditLogs(
  token: string,
  params: { limit?: number; offset?: number; action?: string; resource_type?: string; search?: string } = {}
) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  });
  return api.get(`/api/v1/admin/audit?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
