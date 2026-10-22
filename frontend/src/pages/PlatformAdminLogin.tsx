import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../services/errorMessage";
import { loginPlatformAdmin } from "../services/authService";

interface LoginLocationState {
  notice?: string;
}

export default function PlatformAdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user, isInitializing } = useAuth();
  const notice = (location.state as LoginLocationState | null)?.notice;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isInitializing && user?.role === "SUPER_ADMIN") {
    return <Navigate to="/platform-admin" replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await loginPlatformAdmin({ email: email.trim(), password });
      login(session.user, session.token);
      navigate("/platform-admin", { replace: true });
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Invalid email or password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b1426] px-5 py-12">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl sm:p-10">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8efff] text-[#243f78]">
            <ShieldCheck size={25} aria-hidden="true" />
          </span>
          <div>
            <p className="text-xl font-bold tracking-tight text-slate-900">AegisAI</p>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Platform Console
            </p>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-900">Platform Super Admin</h1>
        <p className="mt-2 text-sm text-slate-500">Sign in to manage the AegisAI platform.</p>

        {notice && (
          <p role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div>
            <label htmlFor="platform-admin-email" className="mb-2 block text-sm font-medium text-slate-700">
              Super Admin Email
            </label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="platform-admin-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                placeholder="admin@example.com"
              />
            </div>
          </div>
          <div>
            <label htmlFor="platform-admin-password" className="mb-2 block text-sm font-medium text-slate-700">
              Password
            </label>
            <div className="relative">
              <LockKeyhole size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="platform-admin-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                placeholder="Enter your password"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Link to="/platform-admin/forgot-password" className="text-sm font-medium text-blue-700 hover:text-blue-800">
              Forgot Password?
            </Link>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#15284b] py-3 font-semibold text-white transition hover:bg-[#203b69] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </section>
    </main>
  );
}
