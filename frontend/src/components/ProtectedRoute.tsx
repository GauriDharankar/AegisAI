import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";

import { useAuth } from "../context/AuthContext";
import { hasApprovedActiveOrganization } from "../services/authService";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
  allowUnapprovedOrganization?: boolean;
}

export default function ProtectedRoute({
  children,
  allowedRoles,
  allowUnapprovedOrganization = false,
}: ProtectedRouteProps) {
  const { user, isInitializing } = useAuth();

  if (isInitializing) {
    return null;
  }

  if (!user) {
    return <Navigate to={allowedRoles?.includes("SUPER_ADMIN") ? "/platform-admin/login" : "/login"} replace />;
  }

  if (user.role === "SUPER_ADMIN") {
    return allowedRoles?.includes(user.role)
      ? <>{children}</>
      : <Navigate to="/platform-admin" replace />;
  }

  if (allowUnapprovedOrganization) {
    if (hasApprovedActiveOrganization(user)) {
      return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
  }

  if (!hasApprovedActiveOrganization(user)) {
    return <Navigate to="/application-status" replace />;
  }

  if (
    allowedRoles &&
    user &&
    !allowedRoles.includes(user.role)
  ) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}