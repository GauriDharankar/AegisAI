export type UserRole =
  | "SUPER_ADMIN"
  | "OPERATIONS"
  | "RISK_OFFICER"
  | "CREDIT_COMMITTEE"
  | "MANAGER";

export type OrganizationVerificationStatus =
  | "PENDING"
  | "UNDER_REVIEW"
  | "VERIFIED"
  | "REJECTED"
  | "INFORMATION_REQUIRED"
  | string;

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  level: 1 | 2 | 3 | 4 | 5;
  tenant_id?: string;
  tenant_name?: string;
  tenant_status?: string;
  verification_status?: OrganizationVerificationStatus;
  verification_reason?: string | null;
  tenant_created_at?: string | null;
  responsibilities?: string[];
  teams?: Array<{ id: string; name: string; role?: string | null }>;
}