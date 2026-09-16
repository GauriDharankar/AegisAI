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
import type { User, UserRole } from "../types/auth";

interface DemoUser {
  email: string;
  password: string;
  role: UserRole;
  level: 1 | 2 | 3 | 4;
  name: string;
}

const demoUsers: DemoUser[] = [
  {
    email: "operations@aegis.ai",
    password: "Aegis123",
    role: "OPERATIONS",
    level: 1,
    name: "Operations User",
  },
  {
    email: "risk@aegis.ai",
    password: "Aegis123",
    role: "RISK_OFFICER",
    level: 2,
    name: "Risk Officer",
  },
  {
    email: "committee@aegis.ai",
    password: "Aegis123",
    role: "CREDIT_COMMITTEE",
    level: 3,
    name: "Credit Committee",
  },
  {
    email: "manager@aegis.ai",
    password: "Aegis123",
    role: "MANAGER",
    level: 4,
    name: "Manager",
  },
];

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError("");

    const normalizedEmail = email.trim().toLowerCase();

    // Basic validation
    if (!normalizedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setIsLoading(true);

    /*
      TEMPORARY FRONTEND AUTHENTICATION

      These demo accounts are only for frontend development.
      Later, replace this section with the FastAPI
      authentication endpoint.
    */

    const matchedUser = demoUsers.find(
      (item) =>
        item.email === normalizedEmail &&
        item.password === password
    );

    if (!matchedUser) {
      setIsLoading(false);
      setError("Invalid email or password.");
      return;
    }

    // Create the authenticated user
    const loggedInUser: User = {
      id: matchedUser.email,
      name: matchedUser.name,
      email: matchedUser.email,
      role: matchedUser.role,
      level: matchedUser.level,
    };

    /*
      AuthContext handles:
      1. React authentication state
      2. localStorage persistence
    */
    login(loggedInUser);

    /*
      Remember me is currently visual/demo-only.
      Authentication persistence is already handled
      by AuthContext using localStorage.
    */
    void rememberMe;

    setIsLoading(false);

    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen">

        {/* =====================================================
            LEFT SECTION
        ====================================================== */}

        <div className="hidden w-1/2 bg-slate-900 lg:flex">
          <div className="flex w-full flex-col justify-between p-12 text-white">

            {/* Logo + Introduction */}
            <div>
              <div className="flex items-center gap-3">

                <div className="rounded-xl bg-blue-600 p-3">
                  <ShieldCheck size={28} />
                </div>

                <div>
                  <h1 className="text-2xl font-bold">
                    AegisAI
                  </h1>

                  <p className="text-sm text-slate-400">
                    AI Governance Platform
                  </p>
                </div>

              </div>

              <div className="mt-20 max-w-lg">
                <h2 className="text-4xl font-bold leading-tight">
                  Responsible AI Decision Governance
                </h2>

                <p className="mt-6 text-lg leading-8 text-slate-400">
                  Securely review, monitor and govern
                  AI-powered lending decisions with
                  human oversight.
                </p>
              </div>
            </div>

            {/* =================================================
                APPROVAL HIERARCHY
            ================================================== */}

            <div className="space-y-3">

              {/* Level 4 */}
              <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                <p className="text-xs text-slate-400">
                  LEVEL 4
                </p>

                <p className="font-semibold">
                  Manager
                </p>

                <p className="text-sm text-slate-400">
                  Access to all decisions
                </p>
              </div>

              {/* Levels 1-3 */}
              <div className="grid grid-cols-3 gap-3">

                {/* Level 3 */}
                <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
                  <p className="text-xs text-slate-400">
                    LEVEL 3
                  </p>

                  <p className="mt-1 text-sm font-medium">
                    Credit Committee
                  </p>
                </div>

                {/* Level 2 */}
                <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
                  <p className="text-xs text-slate-400">
                    LEVEL 2
                  </p>

                  <p className="mt-1 text-sm font-medium">
                    Risk Officer
                  </p>
                </div>

                {/* Level 1 */}
                <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
                  <p className="text-xs text-slate-400">
                    LEVEL 1
                  </p>

                  <p className="mt-1 text-sm font-medium">
                    Operations
                  </p>
                </div>

              </div>
            </div>

          </div>
        </div>


        {/* =====================================================
            LOGIN SECTION
        ====================================================== */}

        <div className="flex w-full items-center justify-center bg-white p-6 lg:w-1/2">

          <div className="w-full max-w-md">

            {/* =================================================
                MOBILE LOGO
            ================================================== */}

            <div className="mb-8 flex items-center gap-3 lg:hidden">

              <div className="rounded-xl bg-blue-600 p-3 text-white">
                <ShieldCheck size={24} />
              </div>

              <div>
                <h1 className="text-xl font-bold text-slate-800">
                  AegisAI
                </h1>

                <p className="text-xs text-slate-500">
                  AI Governance Platform
                </p>
              </div>

            </div>


            {/* =================================================
                PAGE HEADING
            ================================================== */}

            <div className="mb-8">
              <h2 className="text-3xl font-bold text-slate-800">
                Welcome back
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Sign in to access your governance workspace.
              </p>
            </div>


            {/* =================================================
                ERROR MESSAGE
            ================================================== */}

            {error && (
              <div
                role="alert"
                className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600"
              >
                {error}
              </div>
            )}


            {/* =================================================
                LOGIN FORM
            ================================================== */}

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >

              {/* Email */}
              <div>

                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Email Address
                </label>

                <div className="relative">

                  <Mail
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    placeholder="Enter your email"
                    className="w-full rounded-lg border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />

                </div>
              </div>


              {/* Password */}
              <div>

                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Password
                </label>

                <div className="relative">

                  <LockIcon
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    placeholder="Enter your password"
                    className="w-full rounded-lg border border-slate-200 py-3 pl-10 pr-12 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((previous) => !previous)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>

                </div>
              </div>


              {/* Remember / Forgot */}
              <div className="flex items-center justify-between">

                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-500">

                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) =>
                      setRememberMe(e.target.checked)
                    }
                    className="rounded border-slate-300"
                  />

                  Remember me

                </label>

                <button
                  type="button"
                  onClick={() =>
                    setError(
                      "Password recovery will be available when backend authentication is connected."
                    )
                  }
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Forgot password?
                </button>

              </div>


              {/* Sign In */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </button>

            </form>


          </div>

      </div>
    </div>
    </div>
  );
}