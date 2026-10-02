export type UserRole =
  | "OPERATIONS"
  | "RISK_OFFICER"
  | "CREDIT_COMMITTEE"
  | "MANAGER";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  level: 1 | 2 | 3 | 4;
  tenant_id?: string;
  tenant_name?: string;
  responsibilities?: string[];
  teams?: Array<{ id: string; name: string; role?: string | null }>;
}