import api from "./api";

export type PolicyAction = "APPROVE" | "REJECT" | "REVIEW" | "FLAG";
export type PolicySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type PolicyOperator = ">" | ">=" | "<" | "<=" | "==" | "!=";

export interface Policy {
  id: string;
  code: string;
  name: string;
  description: string | null;
  enabled: boolean;
  field: string | null;
  operator: PolicyOperator | null;
  value: number | string | boolean | null;
  action: PolicyAction | null;
  severity: PolicySeverity | null;
  version_number: number | null;
}

export interface PolicyPayload {
  name: string;
  description: string;
  enabled: boolean;
  field: string;
  operator: PolicyOperator;
  value: number | string | boolean;
  action: PolicyAction;
  severity: PolicySeverity;
}

export async function getPolicies(token: string) {
  return api.get<Policy[]>("/api/v1/policies", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createPolicy(token: string, payload: PolicyPayload) {
  return api.post<Policy>("/api/v1/policies", payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updatePolicy(token: string, policyId: string, payload: PolicyPayload) {
  return api.put<Policy>(`/api/v1/policies/${policyId}`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function deletePolicy(token: string, policyId: string) {
  return api.delete(`/api/v1/policies/${policyId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
