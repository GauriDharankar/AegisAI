import axios from "axios";
import { Building2, CalendarDays, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { getPlatformTenants } from "../services/platformAdminService";
import type { PlatformTenant } from "../services/platformAdminService";

function statusBadge(status: string, kind: "account" | "verification") {
  const normalized = status.toUpperCase();
  const styles: Record<string, string> = {
    ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
    INACTIVE: "border-slate-200 bg-slate-100 text-slate-600",
    VERIFIED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    UNDER_REVIEW: "border-blue-200 bg-blue-50 text-blue-700",
    PENDING: "border-amber-200 bg-amber-50 text-amber-700",
    REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
    INFORMATION_REQUIRED: "border-orange-200 bg-orange-50 text-orange-700",
  };
  const label = normalized.replaceAll("_", " ").toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        styles[normalized] ?? (kind === "account"
          ? "border-slate-200 bg-slate-50 text-slate-600"
          : "border-slate-200 bg-slate-50 text-slate-600")
      }`}
    >
      {label}
    </span>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") {
      return detail;
    }
  }
  return "Tenant organizations could not be loaded. Please try again.";
}

export default function PlatformTenants() {
  const { token } = useAuth();
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("ALL");
  const [verificationFilter, setVerificationFilter] = useState("ALL");
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
      const data = await getPlatformTenants(token);
      setTenants(data);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants, reloadKey]);

  const filteredTenants = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tenants.filter((tenant) => {
      const matchesSearch = !query
        || tenant.organization_name.toLowerCase().includes(query)
        || tenant.id.toLowerCase().includes(query);
      const matchesAccount = accountFilter === "ALL"
        || tenant.status.toUpperCase() === accountFilter;
      const matchesVerification = verificationFilter === "ALL"
        || tenant.verification_status.toUpperCase() === verificationFilter;
      return matchesSearch && matchesAccount && matchesVerification;
    });
  }, [accountFilter, search, tenants, verificationFilter]);

  return (
    <div className="space-y-7">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
          Platform workspace
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[30px]">
          Tenant Management
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          View registered organizations and their current account and verification status.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Organizations</h2>
              <p className="mt-1 text-xs text-slate-500">
                {isLoading
                  ? "Loading organizations…"
                  : `${filteredTenants.length} of ${tenants.length} organizations`}
              </p>
            </div>
            <label className="relative block w-full sm:max-w-xs">
              <span className="sr-only">Search organizations</span>
              <Search
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name or tenant ID"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              Account status
              <select
                value={accountFilter}
                onChange={(event) => setAccountFilter(event.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              Verification
              <select
                value={verificationFilter}
                onChange={(event) => setVerificationFilter(event.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="ALL">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="UNDER_REVIEW">Under review</option>
                <option value="VERIFIED">Verified</option>
                <option value="REJECTED">Rejected</option>
                <option value="INFORMATION_REQUIRED">Information required</option>
              </select>
            </label>
          </div>
        </div>

        {error ? (
          <div role="alert" className="m-4 flex flex-col items-start gap-4 rounded-lg border border-rose-200 bg-rose-50 p-4 sm:m-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-rose-800">Unable to load organizations</p>
              <p className="mt-1 text-sm text-rose-700">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setReloadKey((current) => current + 1)}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-sm font-medium text-rose-800 transition hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
            >
              <RefreshCw size={15} aria-hidden="true" />
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <div className="space-y-3 p-5" role="status" aria-live="polite">
            <span className="sr-only">Loading tenant organizations</span>
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : tenants.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Building2 size={21} aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">No organizations found</h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Registered organizations will appear here when they are available.
            </p>
            <button
              type="button"
              onClick={() => setReloadKey((current) => current + 1)}
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <RefreshCw size={15} aria-hidden="true" />
              Refresh
            </button>
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <h3 className="text-sm font-semibold text-slate-900">No matching organizations</h3>
            <p className="mt-1 text-sm text-slate-500">Try changing the search or status filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <th scope="col" className="px-6 py-3.5">Organization</th>
                  <th scope="col" className="px-4 py-3.5">Tenant ID</th>
                  <th scope="col" className="px-4 py-3.5">Account status</th>
                  <th scope="col" className="px-4 py-3.5">Verification</th>
                  <th scope="col" className="px-6 py-3.5">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTenants.map((tenant) => (
                  <tr key={tenant.id} className="transition-colors hover:bg-slate-50/70">
                    <th scope="row" className="px-6 py-4 font-medium">
                      <Link
                        to={`/platform-admin/tenants/${encodeURIComponent(tenant.id)}`}
                        state={{ createdAt: tenant.created_at }}
                        className="block max-w-64 truncate text-sm text-blue-800 underline-offset-4 hover:text-blue-950 hover:underline focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      >
                        {tenant.organization_name}
                      </Link>
                      {tenant.registration_number && (
                        <span className="mt-1 block text-xs text-slate-500">
                          Registration {tenant.registration_number}
                        </span>
                      )}
                    </th>
                    <td className="px-4 py-4">
                      <span className="font-mono text-xs text-slate-600">{tenant.id}</span>
                    </td>
                    <td className="px-4 py-4">{statusBadge(tenant.status, "account")}</td>
                    <td className="px-4 py-4">
                      {statusBadge(tenant.verification_status, "verification")}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs text-slate-600">
                        <CalendarDays size={14} aria-hidden="true" className="text-slate-400" />
                        {formatDate(tenant.created_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
