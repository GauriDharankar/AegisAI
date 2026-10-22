import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
} from "react";

import type { ReactNode } from "react";
import type { User } from "../types/auth";
import {
  getCurrentUser,
  getTokenExpiry,
  logout as logoutRequest,
  refreshSession,
  restoreSession,
} from "../services/authService";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isInitializing: boolean;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  refreshStatus: () => Promise<User>;
}

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const clearExpiredSession = useCallback(() => {
    const storedUser = sessionStorage.getItem("aegis_user");
    let wasPlatformAdmin = false;
    if (storedUser) {
      try {
        wasPlatformAdmin = (JSON.parse(storedUser) as User).role === "SUPER_ADMIN";
      } catch {
        wasPlatformAdmin = false;
      }
    }
    sessionStorage.removeItem("aegis_user");
    sessionStorage.removeItem("aegis_session");
    localStorage.removeItem("aegis_user");
    localStorage.removeItem("aegis_session");
    setUser(null);
    setToken(null);
    window.location.assign(wasPlatformAdmin ? "/platform-admin/login" : "/login");
  }, []);

  useEffect(() => {
    const restoreAuthSession = async () => {
      const session = await restoreSession();

      if (!session) {
        setIsInitializing(false);
        return;
      }

      setUser(session.user);
      setToken(session.token);
      setIsInitializing(false);
    };

    void restoreAuthSession();
  }, []);

  useEffect(() => {
    window.addEventListener("aegis-auth-expired", clearExpiredSession);
    return () => window.removeEventListener("aegis-auth-expired", clearExpiredSession);
  }, [clearExpiredSession]);

  useEffect(() => {
    const handleOrganizationBlocked = () => {
      if (!token) return;

      void getCurrentUser(token)
        .then((currentUser) => {
          sessionStorage.setItem("aegis_user", JSON.stringify(currentUser));
          setUser(currentUser);
        })
        .catch((error: unknown) => {
          console.error("Unable to refresh organization status after an access denial.", error);
          setUser((currentUser) => currentUser
            ? {
              ...currentUser,
              tenant_status: undefined,
              verification_status: "UNKNOWN",
              verification_reason: null,
              tenant_created_at: null,
            }
            : null);
        });
    };

    window.addEventListener("aegis-organization-blocked", handleOrganizationBlocked);
    return () => window.removeEventListener("aegis-organization-blocked", handleOrganizationBlocked);
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const expiry = getTokenExpiry(token);
    if (!expiry) {
      return;
    }

    const refreshDelay = Math.max(expiry - Date.now() - 60_000, 1_000);
    const timer = window.setTimeout(() => {
      void refreshSession(token)
        .then((session) => {
          sessionStorage.setItem("aegis_user", JSON.stringify(session.user));
          sessionStorage.setItem("aegis_session", session.token);
          setUser(session.user);
          setToken(session.token);
        })
        .catch(() => clearExpiredSession());
    }, refreshDelay);

    return () => window.clearTimeout(timer);
  }, [token, clearExpiredSession]);

  const login = (nextUser: User, nextToken: string) => {
    sessionStorage.setItem("aegis_user", JSON.stringify(nextUser));
    sessionStorage.setItem("aegis_session", nextToken);
    localStorage.removeItem("aegis_user");
    localStorage.removeItem("aegis_session");

    setUser(nextUser);
    setToken(nextToken);
  };

  const logout = () => {
    if (token) {
      void logoutRequest(token).catch(() => undefined);
    }

    sessionStorage.removeItem("aegis_user");
    sessionStorage.removeItem("aegis_session");
    localStorage.removeItem("aegis_user");
    localStorage.removeItem("aegis_session");
    setUser(null);
    setToken(null);
  };

  const refreshStatus = async (): Promise<User> => {
    if (!token) {
      throw new Error("Your authenticated session is unavailable. Sign in again.");
    }

    const currentUser = await getCurrentUser(token);
    sessionStorage.setItem("aegis_user", JSON.stringify(currentUser));
    setUser(currentUser);
    return currentUser;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isInitializing,
        isAuthenticated: user !== null,
        login,
        logout,
        refreshStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}