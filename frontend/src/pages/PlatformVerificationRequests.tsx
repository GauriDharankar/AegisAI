import {
  Building2,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  LoaderCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../services/errorMessage";
import { getPlatformTenants } from "../services/platformAdminService";
import type { PlatformTenant } from "../services/platformAdminService";
import { formatIstTimestamp } from "../utils/dateTime";

type ReviewQueueStatus = "PENDING" | "UNDER_REVIEW" | "INFORMATION_REQUIRED";

const queueStatuses: ReviewQueueStatus[] = [
  "PENDING",
  "UNDER_REVIEW",
  "INFORMATION_REQUIRED",
];

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusTone(status: string): string {
  const tones: Record<string, string> = {
    PENDING: "border-amber-200 bg-amber-50 text-amber-800",
    UNDER_REVIEW: "border-blue-200 bg-blue-50 text-blue-700",
    INFORMATION_REQUIRED: "border-orange-200 bg-orange-50 text-orange-800",
  };
  return tones[status.toUpperCase()] ?? "border-slate-200 bg-slate-100 text-slate-600";
}

function accountTone(status: string): string {
  return status.toLowerCase() === "active"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-100 text-slate-600";
}

export default function PlatformVerificationRequests() {
  const { token } = useAuth();
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ReviewQueueStatus>("ALL");
  const [reloadKey, setReloadKey] = useState(0);

  const loadTenants = useCallback(async () => {
    if (!token) {
      setTenants([]);
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
      setError(getErrorMessage(loadError, "Verification requests could not be loaded. Please try again."));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants, reloadKey]);

  const reviewQueue = useMemo(
    () => tenants.filter((tenant) =>
      queueStatuses.includes(tenant.verification_status.toUpperCase() as ReviewQueueStatus)
    ),
    [tenants]
  );

  const filteredTenants = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reviewQueue.filter((tenant) => {
      const matchesSearch = !query
        || tenant.organization_name.toLowerCase().includes(query)
        || tenant.id.toLowerCase().includes(query)
        || (tenant.registration_number ?? "").toLowerCase().includes(query);
      const matchesStatus = statusFilter === "ALL"
        || tenant.verification_status.toUpperCase() === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [reviewQueue, search, statusFilter]);

  return (
    <section aria-label="Organizations awaiting verification" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <ClipboardCheck size={19} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Verification review queue</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Organizations with pending review, active review, or requested information.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            disabled={isLoading}
            className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
          >
            <RefreshCw size={15} aria-hidden="true" className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block w-full sm:max-w-sm">
            <span className="sr-only">Search verification requests</span>
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search organization, ID, or registration"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            Status
            <span className="relative">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "ALL" | ReviewQueueStatus)}
                className="h-10 min-w-44 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="ALL">All queue statuses</option>
                <option value="PENDING">Pending</option>
                <option value="UNDER_REVIEW">Under review</option>
                <option value="INFORMATION_REQUIRED">Information required</option>
              </select>
              <ChevronDown
                size={15}
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </span>
          </label>
          {!isLoading && !error && (
            <p aria-live="polite" className="text-xs text-slate-500 sm:ml-auto">
              {filteredTenants.length} of {reviewQueue.length} requests
            </p>
          )}
        </div>
      </div>

      {error ? (
        <div role="alert" className="m-4 flex flex-col items-start gap-4 rounded-lg border border-rose-200 bg-rose-50 p-4 sm:m-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-rose-800">Unable to load verification requests</p>
            <p className="mt-1 text-sm text-rose-700">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            disabled={isLoading}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-sm font-medium text-rose-800 transition hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:opacity-60"
          >
            <RefreshCw size={15} aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <div role="status" className="flex min-h-56 items-center justify-center gap-3 px-5 text-sm text-slate-600">
          <LoaderCircle size={19} aria-hidden="true" className="animate-spin text-blue-700" />
          Loading verification requests…
        </div>
      ) : filteredTenants.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center px-5 py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            {reviewQueue.length === 0
              ? <Check size={20} aria-hidden="true" />
              : <Search size={20} aria-hidden="true" />}
          </span>
          <h3 className="mt-4 text-sm font-semibold text-slate-900">
            {reviewQueue.length === 0 ? "No organizations awaiting review" : "No matching requests"}
          </h3>
          <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
            {reviewQueue.length === 0
              ? "There are no pending, in-review, or information-requested organizations at this time."
              : "Try another search term or choose a different verification status."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Organization</th>
                <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Verification</th>
                <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Account</th>
                <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Registration</th>
                <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Submitted / reviewed</th>
                <th scope="col" className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTenants.map((tenant) => {
                const created = formatIstTimestamp(tenant.created_at);
                const reviewed = formatIstTimestamp(tenant.verification_reviewed_at);
                return (
                  <tr key={tenant.id} className="align-middle transition-colors hover:bg-slate-50/70">
                    <td className="max-w-64 px-5 py-4">
                      <span className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                          <Building2 size={16} aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            {tenant.organization_name}
                          </span>
                          <span className="mt-1 block break-all font-mono text-[11px] text-slate-500">
                            {tenant.id}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(tenant.verification_status)}`}>
                        {formatLabel(tenant.verification_status)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${accountTone(tenant.status)}`}>
                        {formatLabel(tenant.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600">
                      {tenant.registration_number || <span className="text-slate-400">Not provided</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-1.5 text-xs text-slate-600">
                        {created && (
                          <span className="flex items-center gap-1.5 whitespace-nowrap">
                            <CalendarDays size={14} aria-hidden="true" className="text-slate-400" />
                            Registered {created}
                          </span>
                        )}
                        {reviewed && (
                          <span className="flex items-center gap-1.5 whitespace-nowrap">
                            <CalendarClock size={14} aria-hidden="true" className="text-slate-400" />
                            Reviewed {reviewed}
                          </span>
                        )}
                        {tenant.verification_reason && (
                          <span className="block max-w-56 truncate text-slate-500" title={tenant.verification_reason}>
                            {tenant.verification_reason}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        to={`/platform-admin/tenants/${encodeURIComponent(tenant.id)}`}
                        state={{ tenant }}
                        aria-label={`Open verification review for ${tenant.organization_name}`}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#14233d] px-3 text-xs font-semibold text-white transition hover:bg-[#203a63] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      >
                        Review request
                        <ChevronDown size={14} aria-hidden="true" className="-rotate-90" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
