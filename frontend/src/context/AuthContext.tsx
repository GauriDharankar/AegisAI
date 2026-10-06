import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import type { ReactNode } from "react";
import type { User } from "../types/auth";
import {
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

  const clearExpiredSession = () => {
    sessionStorage.removeItem("aegis_user");
    sessionStorage.removeItem("aegis_session");
    localStorage.removeItem("aegis_user");
    localStorage.removeItem("aegis_session");
    setUser(null);
    setToken(null);
    window.location.assign("/login");
  };

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
  }, []);

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
  }, [token]);

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

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isInitializing,
        isAuthenticated: user !== null,
        login,
        logout,
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