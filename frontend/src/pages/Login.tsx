import { useState } from "react";
import {
  Eye,
  EyeOff,
  Lock as LockIcon,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { login as loginRequest, register as registerRequest } from "../services/authService";
import { getErrorMessage } from "../services/errorMessage";
import type { User } from "../types/auth";

export default function Login({ initialMode = "login" }: { initialMode?: "login" | "register" }) {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setIsLoading(true);
      const session = await loginRequest({
        email: normalizedEmail,
        password,
      });

      const loggedInUser: User = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        level: session.user.level,
        tenant_id: session.user.tenant_id,
        tenant_name: session.user.tenant_name,
        responsibilities: session.user.responsibilities,
        teams: session.user.teams,
      };

      login(loggedInUser, session.token);

      if (rememberMe) {
        sessionStorage.setItem("aegis_session", session.token);
      }

      navigate("/dashboard", { replace: true });
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Invalid email or password."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!organizationName.trim() || !fullName.trim() || !email.trim() || !password) {
      setError("Please complete all registration fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setIsLoading(true);
      const session = await registerRequest({
        organization_name: organizationName.trim(),
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirm_password: confirmPassword,
      });

      const loggedInUser: User = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        level: session.user.level,
        tenant_id: session.user.tenant_id,
        tenant_name: session.user.tenant_name,
        responsibilities: session.user.responsibilities,
        teams: session.user.teams,
      };

      login(loggedInUser, session.token);
      navigate("/dashboard", { replace: true });
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Organization registration failed."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen">
        <div className="hidden w-1/2 bg-slate-900 lg:flex">
          <div className="flex w-full flex-col justify-between p-12 text-white">
            <div>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blue-600 p-3">
                  <ShieldCheck size={28} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">AegisAI</h1>
                  <p className="text-sm text-slate-400">Multi Tenant AI Governance Engine</p>
                </div>
              </div>

              <div className="mt-20 max-w-lg">
                <h2 className="text-4xl font-bold leading-tight">
                  Multi Tenant AI Governance Engine
                </h2>
                <p className="mt-6 text-lg leading-8 text-slate-400">
                  Configure the workflow that matches your organization, review decisions with accountable oversight, and keep governance aligned to the tenant’s operating model.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Tenant scope</p>
                <p className="mt-2 text-lg font-semibold text-white">Organization-first governance</p>
                <p className="mt-2 text-sm text-slate-400">Each tenant has its own workflow, teams, responsibilities, and approval paths.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-full items-center justify-center bg-white p-6 lg:w-1/2">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="rounded-xl bg-blue-600 p-3 text-white">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">AegisAI</h1>
                <p className="text-xs text-slate-500">Multi Tenant AI Governance Engine</p>
              </div>
            </div>

            <div className="mb-8 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-3xl font-bold text-slate-800">
                  {mode === "login" ? "Welcome back" : "Create your workspace"}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {mode === "login"
                    ? "Sign in to access your governance workspace."
                    : "Create a new organization and admin account."}
                </p>
              </div>
              <button
                type="button"
                className="rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                onClick={() => setMode((previous) => (previous === "login" ? "register" : "login"))}
              >
                {mode === "login" ? "Create Organization" : "Back to Login"}
              </button>
            </div>

            {error && (
              <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {mode === "login" ? (
              <form onSubmit={handleLoginSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setError("");
                      }}
                      placeholder="Enter your email"
                      className="w-full rounded-lg border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <div className="relative">
                    <LockIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setError("");
                      }}
                      placeholder="Enter your password"
                      className="w-full rounded-lg border border-slate-200 py-3 pl-10 pr-12 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((previous) => !previous)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-500">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => setError("Password recovery is not enabled yet.")}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-5">
                <div>
                  <label htmlFor="organizationName" className="mb-2 block text-sm font-medium text-slate-700">
                    Organization Name
                  </label>
                  <input
                    id="organizationName"
                    value={organizationName}
                    onChange={(event) => {
                      setOrganizationName(event.target.value);
                      setError("");
                    }}
                    placeholder="Acme Finance"
                    className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label htmlFor="fullName" className="mb-2 block text-sm font-medium text-slate-700">
                    Admin Full Name
                  </label>
                  <input
                    id="fullName"
                    value={fullName}
                    onChange={(event) => {
                      setFullName(event.target.value);
                      setError("");
                    }}
                    placeholder="Jane Smith"
                    className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label htmlFor="register-email" className="mb-2 block text-sm font-medium text-slate-700">
                    Admin Email
                  </label>
                  <input
                    id="register-email"
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError("");
                    }}
                    placeholder="admin@company.com"
                    className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label htmlFor="register-password" className="mb-2 block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <input
                    id="register-password"
                    type="password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                    }}
                    placeholder="Create a strong password"
                    className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-slate-700">
                    Confirm Password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setError("");
                    }}
                    placeholder="Confirm password"
                    className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? "Creating workspace..." : "Create Organization"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}