import api from "./api";
import axios from "axios";
import type { User, UserRole } from "../types/auth";

export interface AuthLoginPayload {
  email: string;
  password: string;
}

export interface AuthRegisterPayload {
  organization_name: string;
  name: string;
  email: string;
  password: string;
  confirm_password: string;
}

export interface AuthApiUser {
  id: string;
  name: string;
  email: string;
  role: string;
  tenant_id?: string;
  tenant_name?: string;
  tenant_status?: string;
  verification_status?: string;
  verification_reason?: string | null;
  tenant_created_at?: string | null;
  level?: number;
  responsibilities?: string[];
  teams?: Array<{ id: string; name: string; role?: string | null }>;
}

export interface AuthSession {
  token: string;
  user: User;
  tenant?: {
    id: string;
    organization_name: string;
    status?: string;
    verification_status?: string;
    verification_reason?: string | null;
    created_at?: string | null;
  };
}

const mapRole = (role: string): UserRole => {
  const normalized = role.toUpperCase().replace(/\s+/g, "_");

  if (normalized === "SUPER_ADMIN") {
    return "SUPER_ADMIN";
  }

  if (normalized.includes("COMMITTEE")) {
    return "CREDIT_COMMITTEE";
  }

  if (normalized.includes("RISK")) {
    return "RISK_OFFICER";
  }

  if (normalized.includes("ADMIN") || normalized.includes("MANAGER")) {
    return "MANAGER";
  }

  return "OPERATIONS";
};

const mapLevel = (role: string): 1 | 2 | 3 | 4 | 5 => {
  const normalized = role.toUpperCase();

  if (normalized === "SUPER ADMIN" || normalized === "SUPER_ADMIN") {
    return 5;
  }

  if (normalized.includes("ADMIN") || normalized.includes("MANAGER")) {
    return 4;
  }

  if (normalized.includes("COMMITTEE")) {
    return 3;
  }

  if (normalized.includes("RISK")) {
    return 2;
  }

  return 1;
};

const mapApiUser = (apiUser: AuthApiUser): User => ({
  id: apiUser.id,
  name: apiUser.name,
  email: apiUser.email,
  role: mapRole(apiUser.role),
  level: (apiUser.level as 1 | 2 | 3 | 4) || mapLevel(apiUser.role),
  tenant_id: apiUser.tenant_id,
  tenant_name: apiUser.tenant_name,
  tenant_status: apiUser.tenant_status,
  verification_status: apiUser.verification_status,
  verification_reason: apiUser.verification_reason,
  tenant_created_at: apiUser.tenant_created_at,
  responsibilities: apiUser.responsibilities,
  teams: apiUser.teams,
});

export const hasApprovedActiveOrganization = (user: User): boolean =>
  user.role === "SUPER_ADMIN"
  || (
    user.tenant_status?.toLowerCase() === "active"
    && user.verification_status?.toUpperCase() === "VERIFIED"
  );

export const getAuthenticatedDestination = (user: User): string => {
  if (user.role === "SUPER_ADMIN") return "/platform-admin";
  return hasApprovedActiveOrganization(user) ? "/dashboard" : "/application-status";
};

export const login = async (payload: AuthLoginPayload) => {
  const response = await api.post("/api/v1/auth/login", payload);
  const apiUser = response.data.user as AuthApiUser;

  return {
    ...response.data,
    user: mapApiUser(apiUser),
  } as AuthSession;
};

export const loginPlatformAdmin = async (payload: AuthLoginPayload): Promise<AuthSession> => {
  const response = await api.post("/api/v1/platform-admin/login", payload);
  return {
    ...response.data,
    user: mapApiUser(response.data.user as AuthApiUser),
  } as AuthSession;
};

export const startPlatformAdminPasswordReset = async (phone_number: string) => {
  const response = await api.post("/api/v1/platform-admin/password-reset/start", { phone_number });
  return response.data as { message: string; development_otp?: string };
};

export const verifyPlatformAdminPasswordResetCode = async (phone_number: string, code: string) => {
  const response = await api.post("/api/v1/platform-admin/password-reset/verify", {
    phone_number,
    code,
  });
  return response.data as { reset_token: string };
};

export const confirmPlatformAdminPasswordReset = async (
  reset_token: string,
  new_password: string,
  confirm_password: string
) => {
  const response = await api.post("/api/v1/platform-admin/password-reset/confirm", {
    reset_token,
    new_password,
    confirm_password,
  });
  return response.data as { message: string };
};

export const changePlatformAdminPassword = async (
  token: string,
  current_password: string,
  new_password: string,
  confirm_password: string
) => {
  const response = await api.post(
    "/api/v1/platform-admin/password/change",
    { current_password, new_password, confirm_password },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data as { message: string };
};

export const register = async (payload: AuthRegisterPayload) => {
  const response = await api.post("/api/v1/auth/register", payload);
  const apiUser = response.data.user as AuthApiUser;

  return {
    ...response.data,
    user: mapApiUser(apiUser),
  } as AuthSession;
};

export const refreshSession = async (token: string): Promise<AuthSession> => {
  const response = await api.post(
    "/api/v1/auth/refresh",
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return {
    ...response.data,
    user: mapApiUser(response.data.user as AuthApiUser),
  } as AuthSession;
};

export const getCurrentUser = async (token: string): Promise<User> => {
  const response = await api.get("/api/v1/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return mapApiUser(response.data as AuthApiUser);
};

export const getTokenExpiry = (token: string): number | null => {
  try {
    const payloadSegment = token.split(".")[0];
    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(
      atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="))
    ) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

export const logout = async (token: string) => {
  await api.post(
    "/api/v1/auth/logout",
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};

export const restoreSession = async (): Promise<AuthSession | null> => {
  const token = sessionStorage.getItem("aegis_session");
  const storedUser = sessionStorage.getItem("aegis_user");

  if (!token || !storedUser) {
    return null;
  }

  let cachedUser: User;

  try {
    cachedUser = JSON.parse(storedUser) as User;
  } catch {
    sessionStorage.removeItem("aegis_session");
    sessionStorage.removeItem("aegis_user");
    return null;
  }

  try {
    const user = await getCurrentUser(token);

    sessionStorage.setItem("aegis_user", JSON.stringify(user));

    return {
      token,
      user,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      sessionStorage.removeItem("aegis_session");
      sessionStorage.removeItem("aegis_user");
      return null;
    }

    if (cachedUser.role === "SUPER_ADMIN") {
      sessionStorage.removeItem("aegis_session");
      sessionStorage.removeItem("aegis_user");
      return null;
    }

    const statusUnavailableUser: User = {
      ...cachedUser,
      tenant_status: undefined,
      verification_status: "UNKNOWN",
      verification_reason: null,
      tenant_created_at: null,
    };

    return {
      token,
      user: statusUnavailableUser,
    };
  }
};

export default {
  login,
  register,
  refreshSession,
  getTokenExpiry,
  logout,
  getCurrentUser,
  restoreSession,
};