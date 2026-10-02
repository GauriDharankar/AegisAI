import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import type { ReactNode } from "react";
import type { User } from "../types/auth";
import { restoreSession, logout as logoutRequest } from "../services/authService";

interface AuthContextType {
  user: User | null;
  token: string | null;
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

  useEffect(() => {
    const restoreAuthSession = async () => {
      const session = await restoreSession();

      if (!session) {
        return;
      }

      setUser(session.user);
      setToken(session.token);
    };

    void restoreAuthSession();
  }, []);

  const login = (nextUser: User, nextToken: string) => {
    localStorage.setItem("aegis_user", JSON.stringify(nextUser));
    localStorage.setItem("aegis_session", nextToken);

    setUser(nextUser);
    setToken(nextToken);
  };

  const logout = () => {
    if (token) {
      void logoutRequest(token).catch(() => undefined);
    }

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