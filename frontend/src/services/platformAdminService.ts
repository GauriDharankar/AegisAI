import api from "./api";

export interface PlatformTenant {
  id: string;
  organization_name: string;
  status: string;
  verification_status: string;
  registration_number: string | null;
  verification_reviewed_at: string | null;
  verification_reviewer_id: string | null;
  verification_reason: string | null;
  created_at: string;
}

export type PlatformTenantVerificationDetails = Omit<PlatformTenant, "created_at">;

export interface PlatformTenantAccountStatus {
  id: string;
  organization_name: string;
  status: string;
  verification_status: string;
}

export interface PlatformActivityItem {
  id: string;
  actor_user_id: string;
  tenant_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export async function getPlatformActivity(
  token: string,
  limit = 25,
  offset = 0
): Promise<PlatformActivityItem[]> {
  const response = await api.get<PlatformActivityItem[]>(
    "/api/v1/platform-admin/activity",
    {
      params: { limit, offset },
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return response.data;
}

export async function getPlatformTenants(token: string): Promise<PlatformTenant[]> {
  const response = await api.get<PlatformTenant[]>("/api/v1/platform-admin/tenants", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export async function getPlatformTenantVerification(
  token: string,
  tenantId: string
): Promise<PlatformTenantVerificationDetails> {
  const response = await api.get<PlatformTenantVerificationDetails>(
    `/api/v1/platform-admin/tenants/${encodeURIComponent(tenantId)}/verification`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

export async function markPlatformTenantUnderReview(
  token: string,
  tenantId: string
): Promise<PlatformTenantVerificationDetails> {
  const response = await api.post<PlatformTenantVerificationDetails>(
    `/api/v1/platform-admin/tenants/${encodeURIComponent(tenantId)}/verification/review`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

export async function approvePlatformTenantVerification(
  token: string,
  tenantId: string
): Promise<PlatformTenantVerificationDetails> {
  const response = await api.post<PlatformTenantVerificationDetails>(
    `/api/v1/platform-admin/tenants/${encodeURIComponent(tenantId)}/verification/approve`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

export async function rejectPlatformTenantVerification(
  token: string,
  tenantId: string,
  reason: string
): Promise<PlatformTenantVerificationDetails> {
  const response = await api.post<PlatformTenantVerificationDetails>(
    `/api/v1/platform-admin/tenants/${encodeURIComponent(tenantId)}/verification/reject`,
    { reason },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

export async function requestPlatformTenantInformation(
  token: string,
  tenantId: string,
  reason: string
): Promise<PlatformTenantVerificationDetails> {
  const response = await api.post<PlatformTenantVerificationDetails>(
    `/api/v1/platform-admin/tenants/${encodeURIComponent(tenantId)}/verification/request-information`,
    { reason },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

export async function activatePlatformTenant(
  token: string,
  tenantId: string
): Promise<PlatformTenantAccountStatus> {
  const response = await api.post<PlatformTenantAccountStatus>(
    `/api/v1/platform-admin/tenants/${encodeURIComponent(tenantId)}/activate`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

export async function deactivatePlatformTenant(
  token: string,
  tenantId: string
): Promise<PlatformTenantAccountStatus> {
  const response = await api.post<PlatformTenantAccountStatus>(
    `/api/v1/platform-admin/tenants/${encodeURIComponent(tenantId)}/deactivate`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}
