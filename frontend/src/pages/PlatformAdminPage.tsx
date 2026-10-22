import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../services/errorMessage";
import { getPlatformTenants } from "../services/platformAdminService";
import type { PlatformTenant } from "../services/platformAdminService";
import { formatIstTimestamp } from "../utils/dateTime";

import PlatformAdminActivity from "./PlatformAdminActivity";
import PlatformVerificationRequests from "./PlatformVerificationRequests";

const sections: Record<string, { title: string; description: string }> = {
  "/platform-admin": {
    title: "Overview",
    description: "A central workspace for platform-level organization governance.",
  },
  "/platform-admin/tenants": {
    title: "Tenant Management",
    description: "Organization management tools will be available here.",
  },
  "/platform-admin/verifications": {
    title: "Verification Requests",
    description: "Organization verification review tools will be available here.",
  },
  "/platform-admin/activity": {
    title: "Admin Activity",
    description: "Review platform-level administrative actions and tenant status changes.",
  },
};

const overviewLinks = [
  {
    title: "Tenant Management",
    description: "Manage the registered organization workspace.",
    path: "/platform-admin/tenants",
    icon: Building2,
  },
  {
    title: "Verification Requests",
    description: "Review organization verification workflows.",
    path: "/platform-admin/verifications",
    icon: ClipboardCheck,
  },
  {
    title: "Admin Activity",
    description: "View platform administrator activity.",
    path: "/platform-admin/activity",
    icon: Clock3,
  },
];

function formatStatus(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function verificationTone(status: string): string {
  const tones: Record<string, string> = {
    PENDING: "border-amber-200 bg-amber-50 text-amber-800",
    UNDER_REVIEW: "border-blue-200 bg-blue-50 text-blue-700",
    VERIFIED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
    INFORMATION_REQUIRED: "border-orange-200 bg-orange-50 text-orange-800",
  };
  return tones[status.toUpperCase()] ?? "border-slate-200 bg-slate-100 text-slate-600";
}

function PlatformOverview() {
  const { token, user } = useAuth();
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadTenants = useCallback(async () => {
    if (!token) {
      setError("Your authenticated platform session is unavailable. Sign in again to continue.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      setTenants(await getPlatformTenants(token));
    } catch (loadError) {
      setTenants([]);
      setError(getErrorMessage(loadError, "Platform overview data could not be loaded. Please try again."));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants, reloadKey]);

  const summary = useMemo(() => ({
    total: tenants.length,
    active: tenants.filter((tenant) => tenant.status.toLowerCase() === "active").length,
    awaitingReview: tenants.filter((tenant) =>
      ["PENDING", "UNDER_REVIEW"].includes(tenant.verification_status.toUpperCase())
    ).length,
    verified: tenants.filter((tenant) =>
      tenant.verification_status.toUpperCase() === "VERIFIED"
    ).length,
  }), [tenants]);

  const recentTenants = useMemo(
    () => [...tenants]
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
      .slice(0, 5),
    [tenants]
  );

  const cards = [
    {
      label: "Registered organizations",
      value: summary.total,
      note: "Organizations in the platform",
      icon: Building2,
      iconStyle: "bg-indigo-50 text-indigo-700",
    },
    {
      label: "Active accounts",
      value: summary.active,
      note: "Currently enabled tenants",
      icon: UsersRound,
      iconStyle: "bg-teal-50 text-teal-700",
    },
    {
      label: "Awaiting review",
      value: summary.awaitingReview,
      note: "Pending or under review",
      icon: ClipboardCheck,
      iconStyle: "bg-amber-50 text-amber-700",
      path: "/platform-admin/verifications",
    },
    {
      label: "Verified organizations",
      value: summary.verified,
      note: "Verification status",
      icon: CheckCircle2,
      iconStyle: "bg-emerald-50 text-emerald-700",
    },
  ];

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-2xl bg-[#111e36] px-6 py-7 text-white shadow-sm sm:px-9 sm:py-9">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-white/[0.08]" />
        <div className="pointer-events-none absolute -right-4 -top-12 h-40 w-40 rounded-full border border-white/[0.08]" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/[0.08] px-3 py-1.5 text-[11px] font-medium text-cyan-100">
              <ShieldCheck size={14} aria-hidden="true" />
              Platform-level access
            </span>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
              {user?.name ? `Welcome back, ${user.name.split(" ")[0]}` : "Super Admin Overview"}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
              A clear view of organization access and verification across your platform.
              Summary figures reflect the registered tenant data currently available.
            </p>
          </div>
          <Link
            to="/platform-admin/tenants"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-semibold text-[#10213a] shadow-sm transition hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Manage organizations
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section aria-labelledby="platform-summary-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 id="platform-summary-heading" className="text-base font-semibold text-slate-900">
              Platform at a glance
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Live counts from registered organization records.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            disabled={isLoading}
            aria-label="Refresh platform overview"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={16} aria-hidden="true" className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>

        {error ? (
          <div role="alert" className="flex flex-col items-start gap-4 rounded-xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-rose-800">Unable to load overview data</p>
              <p className="mt-1 text-sm text-rose-700">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setReloadKey((current) => current + 1)}
              disabled={isLoading}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-sm font-medium text-rose-800 transition hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:opacity-50"
            >
              <RefreshCw size={15} aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(({ label, value, note, icon: Icon, iconStyle, path }) => {
              const contents = (
                <>
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconStyle}`}>
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <span className="mt-5 block text-3xl font-semibold tracking-tight text-slate-950">
                    {isLoading ? <span aria-label="Loading" className="inline-block h-9 w-12 animate-pulse rounded-md bg-slate-100" /> : value}
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-slate-800">{label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{note}</span>
                </>
              );

              return path ? (
                <Link
                  key={label}
                  to={path}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  {contents}
                </Link>
              ) : (
                <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  {contents}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Recent organizations</h2>
              <p className="mt-1 text-xs text-slate-500">Latest registrations from tenant records</p>
            </div>
            <Link
              to="/platform-admin/tenants"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              View all
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>

          {error ? (
            <p className="px-5 py-8 text-sm text-slate-500 sm:px-6">
              Recent organizations are unavailable until overview data can be loaded.
            </p>
          ) : isLoading ? (
            <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-500">
              <LoaderCircle size={17} aria-hidden="true" className="animate-spin text-blue-700" />
              Loading organizations…
            </div>
          ) : recentTenants.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center px-5 py-8 text-center">
              <Building2 size={22} aria-hidden="true" className="text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-800">No organizations registered</p>
              <p className="mt-1 text-xs text-slate-500">Registered tenants will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentTenants.map((tenant) => (
                <li key={tenant.id}>
                  <Link
                    to={`/platform-admin/tenants/${encodeURIComponent(tenant.id)}`}
                    state={{ tenant }}
                    className="flex min-h-[68px] flex-col gap-3 px-5 py-3 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-600 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-800">{tenant.organization_name}</span>
                      <span className="mt-1 block truncate font-mono text-[11px] text-slate-500">{tenant.id}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold ${verificationTone(tenant.verification_status)}`}>
                        {formatStatus(tenant.verification_status)}
                      </span>
                      <span className="hidden w-20 text-right text-xs text-slate-500 sm:inline">
                        {formatIstTimestamp(tenant.created_at)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <section aria-labelledby="platform-shortcuts-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <Activity size={19} aria-hidden="true" />
            </span>
            <div>
              <h2 id="platform-shortcuts-heading" className="text-sm font-semibold text-slate-900">Platform workspace</h2>
              <p className="mt-1 text-xs text-slate-500">Go directly to an administration area</p>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {overviewLinks.map(({ title, description, path, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className="group flex min-h-[68px] items-center gap-3 rounded-lg border border-slate-100 p-3 transition hover:border-blue-100 hover:bg-blue-50/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition group-hover:bg-white group-hover:text-blue-700">
                  <Icon size={17} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800">{title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>
                </span>
                <ArrowRight size={15} aria-hidden="true" className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-700" />
              </Link>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

export default function PlatformAdminPage() {
  const { pathname } = useLocation();
  const section = sections[pathname] ?? sections["/platform-admin"];
  const isOverview = pathname === "/platform-admin";
  const isActivity = pathname === "/platform-admin/activity";
  const isVerificationRequests = pathname === "/platform-admin/verifications";

  return (
    <div className="space-y-7">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
          Platform workspace
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[30px]">
          {section.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          {section.description}
        </p>
      </div>

      {isOverview ? (
        <PlatformOverview />
      ) : isActivity ? (
        <PlatformAdminActivity />
      ) : isVerificationRequests ? (
        <PlatformVerificationRequests />
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex max-w-2xl items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <ShieldCheck size={21} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{section.description}</p>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                This section is a shell placeholder. No tenant data or activity is shown here yet.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
