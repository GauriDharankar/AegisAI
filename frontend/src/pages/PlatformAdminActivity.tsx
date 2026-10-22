import {
  Activity,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  FileText,
  LoaderCircle,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../services/errorMessage";
import { getPlatformActivity } from "../services/platformAdminService";
import type { PlatformActivityItem } from "../services/platformAdminService";
import { formatIstTimestamp } from "../utils/dateTime";

const PAGE_SIZE = 25;

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function actionTone(action: string): string {
  if (action.includes("approved") || action.includes("activated")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (action.includes("rejected") || action.includes("deactivated")) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (action.includes("information_requested")) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function StatusChange({ event }: { event: PlatformActivityItem }) {
  const previousStatus = event.metadata.previous_status;
  const newStatus = event.metadata.new_status;
  if (typeof previousStatus !== "string" || typeof newStatus !== "string") {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-600">
        {formatLabel(previousStatus)}
      </span>
      <span aria-hidden="true" className="text-slate-400">→</span>
      <span className="rounded-md bg-blue-50 px-2 py-1 font-semibold text-blue-700">
        {formatLabel(newStatus)}
      </span>
      {typeof event.metadata.status_type === "string" && (
        <span className="ml-1 text-[11px] text-slate-500">
          {formatLabel(event.metadata.status_type)} status
        </span>
      )}
    </div>
  );
}

export default function PlatformAdminActivity() {
  const { token } = useAuth();
  const [events, setEvents] = useState<PlatformActivityItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadEvents = useCallback(async () => {
    if (!token) {
      setEvents([]);
      setError("Your authenticated platform session is unavailable. Sign in again to continue.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await getPlatformActivity(token, PAGE_SIZE + 1, offset);
      setEvents(response.slice(0, PAGE_SIZE));
      setHasNextPage(response.length > PAGE_SIZE);
    } catch (loadError) {
      setEvents([]);
      setHasNextPage(false);
      setError(getErrorMessage(loadError, "Platform activity could not be loaded. Please try again."));
    } finally {
      setIsLoading(false);
    }
  }, [offset, token]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents, reloadKey]);

  const retry = () => setReloadKey((current) => current + 1);
  const firstItem = offset + 1;
  const lastItem = offset + events.length;

  return (
    <section aria-label="Platform administrator activity" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Activity size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Platform activity</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Administrative actions recorded for tenant organizations.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={retry}
          disabled={isLoading}
          className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
        >
          <RefreshCw size={15} aria-hidden="true" className={isLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error ? (
        <div role="alert" className="m-4 flex flex-col items-start gap-4 rounded-lg border border-rose-200 bg-rose-50 p-4 sm:m-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-rose-800">Unable to load activity</p>
            <p className="mt-1 text-sm text-rose-700">{error}</p>
          </div>
          <button
            type="button"
            onClick={retry}
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
          Loading platform activity…
        </div>
      ) : events.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center px-5 py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <CalendarClock size={20} aria-hidden="true" />
          </span>
          <h3 className="mt-4 text-sm font-semibold text-slate-900">No activity recorded</h3>
          <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
            {offset > 0
              ? "There are no events on this page. Return to the previous page to continue browsing."
              : "Platform administration events will appear here when recorded."}
          </p>
          {offset > 0 && (
            <button
              type="button"
              onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
              className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <ChevronLeft size={16} aria-hidden="true" />
              Previous page
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Time</th>
                  <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Action</th>
                  <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Administrator</th>
                  <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Affected tenant</th>
                  <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Resource and details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((event) => (
                  <tr key={event.id} className="align-top transition-colors hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-600">
                      <time dateTime={event.timestamp}>{formatIstTimestamp(event.timestamp)}</time>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${actionTone(event.action)}`}>
                        {formatLabel(event.action)}
                      </span>
                    </td>
                    <td className="max-w-40 px-5 py-4">
                      <span className="flex items-center gap-2 text-xs font-medium text-slate-700">
                        <UserRound size={14} aria-hidden="true" className="shrink-0 text-slate-400" />
                        <span className="break-all font-mono">{event.actor_user_id}</span>
                      </span>
                    </td>
                    <td className="max-w-40 px-5 py-4">
                      <span className="flex items-center gap-2 text-xs font-medium text-slate-700">
                        <Building2 size={14} aria-hidden="true" className="shrink-0 text-slate-400" />
                        <span className="break-all font-mono">{event.tenant_id}</span>
                      </span>
                    </td>
                    <td className="max-w-[340px] px-5 py-4">
                      <div className="flex items-start gap-2 text-xs text-slate-600">
                        <FileText size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-slate-400" />
                        <span className="break-all">
                          <span className="font-medium text-slate-700">{formatLabel(event.resource_type)}</span>
                          <span className="mx-1 text-slate-400">·</span>
                          <span className="font-mono">{event.resource_id}</span>
                        </span>
                      </div>
                      {(typeof event.metadata.previous_status === "string"
                        && typeof event.metadata.new_status === "string") || typeof event.metadata.reason === "string" ? (
                        <div className="mt-2 space-y-2 pl-[22px]">
                          <StatusChange event={event} />
                          {typeof event.metadata.reason === "string" && event.metadata.reason.trim() && (
                            <p className="max-w-[320px] whitespace-normal break-words text-xs leading-5 text-slate-500">
                              <span className="font-medium text-slate-600">Reason:</span> {event.metadata.reason}
                            </p>
                          )}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p aria-live="polite" className="text-xs text-slate-500">
              Showing {firstItem}–{lastItem} events
            </p>
            <nav aria-label="Activity pagination" className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
                disabled={offset === 0 || isLoading}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft size={16} aria-hidden="true" />
                Previous
              </button>
              <button
                type="button"
                onClick={() => setOffset((current) => current + PAGE_SIZE)}
                disabled={!hasNextPage || isLoading}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          </div>
        </>
      )}
    </section>
  );
}
