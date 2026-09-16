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
}