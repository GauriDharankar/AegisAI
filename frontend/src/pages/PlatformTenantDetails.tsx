import axios from "axios";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CalendarDays,
  CirclePower,
  ClipboardList,
  Check,
  Hash,
  LoaderCircle,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  X,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { useToast } from "../components/ToastProvider";
import { useAuth } from "../context/AuthContext";
import {
  activatePlatformTenant,
  approvePlatformTenantVerification,
  deactivatePlatformTenant,
  getPlatformTenantVerification,
  markPlatformTenantUnderReview,
  rejectPlatformTenantVerification,
  requestPlatformTenantInformation,
  type PlatformTenantVerificationDetails,
} from "../services/platformAdminService";
import { formatIstTimestamp } from "../utils/dateTime";

interface TenantListNavigationState {
  createdAt?: unknown;
  tenant?: {
    created_at?: unknown;
  };
}

function formatLabel(value: string): string {
  return value.replaceAll("_", " ").toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") {
      return detail;
    }
    if (error.response?.status === 404) {
      return "This tenant could not be found.";
    }
  }
  return "Tenant verification details could not be loaded. Please try again.";
}

function StatusPill({ value, kind }: { value: string; kind: "account" | "verification" }) {
  const normalized = value.toUpperCase();
  const colors: Record<string, string> = {
    ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
    INACTIVE: "border-slate-200 bg-slate-100 text-slate-600",
    VERIFIED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    UNDER_REVIEW: "border-blue-200 bg-blue-50 text-blue-700",
    PENDING: "border-amber-200 bg-amber-50 text-amber-700",
    REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
    INFORMATION_REQUIRED: "border-orange-200 bg-orange-50 text-orange-700",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
        colors[normalized] ?? "border-slate-200 bg-slate-50 text-slate-600"
      }`}
      aria-label={`${kind === "account" ? "Account" : "Verification"} status: ${formatLabel(value)}`}
    >
      {formatLabel(value)}
    </span>
  );
}

type VerificationAction = "review" | "approve" | "reject" | "request-information";
type TenantAccountAction = "activate" | "deactivate";
type TenantAction = VerificationAction | TenantAccountAction;

const actionLabels: Record<VerificationAction, string> = {
  review: "Start review",
  approve: "Approve verification",
  reject: "Reject verification",
  "request-information": "Request more information",
};

function DetailField({
  label,
  value,
  icon: Icon,
  mono = false,
}: {
  label: string;
  value: string | null | undefined;
  icon: typeof Building2;
  mono?: boolean;
}) {
  if (!value) return null;

  return (
    <div className="flex min-w-0 gap-3 py-3">
      <Icon size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <dt className="text-xs font-medium text-slate-500">{label}</dt>
        <dd className={`mt-1 break-words text-sm text-slate-800 ${mono ? "font-mono text-xs" : ""}`}>
          {value}
        </dd>
      </div>
    </div>
  );
}

export default function PlatformTenantDetails() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { token } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const navigationState = location.state as TenantListNavigationState | null;
  const createdAtValue = navigationState?.createdAt ?? navigationState?.tenant?.created_at;
  const createdAt = typeof createdAtValue === "string"
    ? createdAtValue
    : null;
  const [tenant, setTenant] = useState<PlatformTenantVerificationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [submittingAction, setSubmittingAction] = useState<TenantAction | null>(null);
  const [reasonAction, setReasonAction] = useState<"reject" | "request-information" | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [accountActionError, setAccountActionError] = useState<string | null>(null);

  const loadTenant = useCallback(async () => {
    if (!token || !tenantId) {
      setError("Tenant details are unavailable. Return to the tenant list and try again.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const details = await getPlatformTenantVerification(token, tenantId);
      setTenant(details);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, token]);

  useEffect(() => {
    void loadTenant();
  }, [loadTenant, reloadKey]);

  const availableActions: VerificationAction[] = tenant
    ? tenant.verification_status === "UNDER_REVIEW"
      ? ["approve", "reject", "request-information"]
      : tenant.verification_status === "PENDING"
        || tenant.verification_status === "REJECTED"
        || tenant.verification_status === "INFORMATION_REQUIRED"
        ? ["review"]
        : []
    : [];

  const submitAction = async (
    action: VerificationAction,
    suppliedReason?: string
  ) => {
    const cleanedReason = suppliedReason?.trim();
    if ((action === "reject" || action === "request-information") && !cleanedReason) {
      setReasonError("Enter a reason before continuing.");
      return;
    }
    if (!token || !tenantId || !tenant) return;

    const confirmation = action === "review"
      ? `Move ${tenant.organization_name} to under review?`
      : action === "approve"
        ? `Approve verification for ${tenant.organization_name}?`
        : action === "reject"
          ? `Reject verification for ${tenant.organization_name}?`
          : `Request more information from ${tenant.organization_name}?`;
    if (!window.confirm(confirmation)) return;

    setSubmittingAction(action);
    setActionError(null);
    try {
      if (action === "review") {
        await markPlatformTenantUnderReview(token, tenantId);
      } else if (action === "approve") {
        await approvePlatformTenantVerification(token, tenantId);
      } else if (action === "reject") {
        await rejectPlatformTenantVerification(token, tenantId, cleanedReason!);
      } else {
        await requestPlatformTenantInformation(token, tenantId, cleanedReason!);
      }

      setReasonAction(null);
      setReason("");
      setReasonError(null);
      await loadTenant();
      showToast(`${actionLabels[action]} completed successfully.`);
    } catch (submitError) {
      const message = getErrorMessage(submitError);
      setActionError(message);
      showToast(message, "error");
    } finally {
      setSubmittingAction(null);
    }
  };

  const submitAccountAction = async (action: TenantAccountAction) => {
    if (!token || !tenantId || !tenant) return;

    const activating = action === "activate";
    const confirmation = activating
      ? `Activate ${tenant.organization_name}? This will restore access for its users.`
      : `Deactivate ${tenant.organization_name}? This will block access for its users.`;
    if (!window.confirm(confirmation)) return;

    setSubmittingAction(action);
    setAccountActionError(null);
    try {
      if (activating) {
        await activatePlatformTenant(token, tenantId);
      } else {
        await deactivatePlatformTenant(token, tenantId);
      }

      await loadTenant();
      showToast(`Organization ${activating ? "activated" : "deactivated"} successfully.`);
    } catch (submitError) {
      const message = getErrorMessage(submitError);
      setAccountActionError(message);
      showToast(message, "error");
    } finally {
      setSubmittingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        to="/platform-admin/tenants"
        className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-medium text-slate-600 transition hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
      >
        <ArrowLeft size={17} aria-hidden="true" />
        Back to tenant management
      </Link>

      {error ? (
        <section role="alert" className="rounded-xl border border-rose-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Unable to load tenant details</h1>
          <p className="mt-2 text-sm text-rose-700">{error}</p>
          <button
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <RefreshCw size={15} aria-hidden="true" />
            Retry
          </button>
        </section>
      ) : isLoading ? (
        <section role="status" aria-live="polite" className="space-y-4">
          <span className="sr-only">Loading tenant verification details</span>
          <div className="h-36 animate-pulse rounded-xl bg-white" />
          <div className="h-64 animate-pulse rounded-xl bg-white" />
        </section>
      ) : tenant ? (
        <>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-gradient-to-r from-white via-white to-blue-50/70 px-5 py-6 sm:px-8">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                <div className="flex min-w-0 items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-800">
                    <Building2 size={22} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                      Organization profile
                    </p>
                    <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight text-slate-950">
                      {tenant.organization_name}
                    </h1>
                    <p className="mt-1 font-mono text-xs text-slate-500">{tenant.id}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <StatusPill value={tenant.status} kind="account" />
                  <StatusPill value={tenant.verification_status} kind="verification" />
                </div>
              </div>
            </div>
            <div className="grid gap-6 px-5 py-5 sm:grid-cols-2 sm:px-8">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Building2 size={16} className="text-blue-700" aria-hidden="true" />
                  Organization details
                </h2>
                <dl className="mt-2 divide-y divide-slate-100">
                  <DetailField label="Organization name" value={tenant.organization_name} icon={Building2} />
                  <DetailField label="Tenant ID" value={tenant.id} icon={Hash} mono />
                  <DetailField
                    label="Registration number"
                    value={tenant.registration_number}
                    icon={ClipboardList}
                    mono
                  />
                  {createdAt && (
                    <DetailField
                      label="Organization created"
                      value={formatIstTimestamp(createdAt)}
                      icon={CalendarDays}
                    />
                  )}
                </dl>
              </div>

              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ShieldCheck size={16} className="text-blue-700" aria-hidden="true" />
                  Verification record
                </h2>
                <dl className="mt-2 divide-y divide-slate-100">
                  <div className="flex min-w-0 gap-3 py-3">
                    <ShieldCheck size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-slate-400" />
                    <div>
                      <dt className="text-xs font-medium text-slate-500">Verification status</dt>
                      <dd className="mt-1"><StatusPill value={tenant.verification_status} kind="verification" /></dd>
                    </div>
                  </div>
                  <DetailField
                    label="Last reviewed"
                    value={formatIstTimestamp(tenant.verification_reviewed_at)}
                    icon={CalendarClock}
                  />
                  <DetailField
                    label="Reviewer ID"
                    value={tenant.verification_reviewer_id}
                    icon={UserRound}
                    mono
                  />
                  {tenant.verification_reason && (
                    <div className="flex min-w-0 gap-3 py-3">
                      <ClipboardList size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-slate-400" />
                      <div className="min-w-0">
                        <dt className="text-xs font-medium text-slate-500">Review reason</dt>
                        <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
                          {tenant.verification_reason}
                        </dd>
                      </div>
                    </div>
                  )}
                </dl>
              </div>
            </div>
            {availableActions.length > 0 && (
              <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-5 sm:px-8">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Verification actions</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Actions follow the current verification status and require confirmation.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableActions.map((action) => {
                      const isApprove = action === "approve";
                      const isReject = action === "reject";
                      const isRequest = action === "request-information";
                      const Icon = isApprove ? Check : isReject ? X : isRequest ? MessageSquareText : ShieldCheck;
                      return (
                        <button
                          key={action}
                          type="button"
                          disabled={submittingAction !== null}
                          onClick={() => {
                            setActionError(null);
                            if (isReject || isRequest) {
                              setReason("");
                              setReasonError(null);
                              setReasonAction(action);
                            } else {
                              void submitAction(action);
                            }
                          }}
                          className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                            isApprove
                              ? "bg-emerald-700 text-white hover:bg-emerald-800 focus-visible:outline-emerald-700"
                              : isReject
                                ? "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 focus-visible:outline-rose-600"
                                : isRequest
                                  ? "border border-blue-200 bg-white text-blue-800 hover:bg-blue-50 focus-visible:outline-blue-600"
                                  : "bg-[#14213a] text-white hover:bg-[#1c3154] focus-visible:outline-blue-600"
                          }`}
                        >
                          {submittingAction === action
                            ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
                            : <Icon size={15} aria-hidden="true" />}
                          {submittingAction === action ? "Submitting…" : actionLabels[action]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {actionError && (
                  <p role="alert" className="mt-3 text-sm text-rose-700">{actionError}</p>
                )}
              </div>
            )}
            {tenant.verification_status === "VERIFIED"
              && (tenant.status === "active" || tenant.status === "inactive") && (
              <div className="border-t border-slate-200 px-5 py-5 sm:px-8">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <CirclePower size={16} className="text-blue-700" aria-hidden="true" />
                      Organization access
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Account access is separate from verification status. These actions do not change verification history.
                    </p>
                  </div>
                  {tenant.status === "active" ? (
                    <button
                      type="button"
                      disabled={submittingAction !== null}
                      onClick={() => void submitAccountAction("deactivate")}
                      className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-rose-200 bg-white px-3.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
                    >
                      {submittingAction === "deactivate"
                        ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
                        : <X size={15} aria-hidden="true" />}
                      {submittingAction === "deactivate" ? "Deactivating…" : "Deactivate"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={submittingAction !== null}
                      onClick={() => void submitAccountAction("activate")}
                      className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg bg-emerald-700 px-3.5 text-sm font-medium text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
                    >
                      {submittingAction === "activate"
                        ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
                        : <Check size={15} aria-hidden="true" />}
                      {submittingAction === "activate" ? "Activating…" : "Activate"}
                    </button>
                  )}
                </div>
                {accountActionError && (
                  <p role="alert" className="mt-3 text-sm text-rose-700">{accountActionError}</p>
                )}
              </div>
            )}
          </section>
          <p className="text-xs leading-5 text-slate-500">
            This view is read-only. Verification documents are not available from the current tenant-detail API.
          </p>
        </>
      ) : null}

      {reasonAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="verification-reason-title"
            className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <h2 id="verification-reason-title" className="text-lg font-semibold text-slate-900">
              {reasonAction === "reject" ? "Reject verification" : "Request more information"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Provide a reason. It will be stored with the tenant verification record.
            </p>
            <label htmlFor="verification-action-reason" className="mt-5 block text-sm font-medium text-slate-700">
              Reason <span aria-hidden="true" className="text-rose-600">*</span>
            </label>
            <textarea
              id="verification-action-reason"
              autoFocus
              rows={4}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                if (event.target.value.trim()) setReasonError(null);
              }}
              aria-invalid={reasonError ? "true" : undefined}
              aria-describedby={reasonError ? "verification-reason-error" : undefined}
              className="mt-2 w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {reasonError && (
              <p id="verification-reason-error" role="alert" className="mt-1 text-xs text-rose-700">
                {reasonError}
              </p>
            )}
            <div className="mt-5 flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <button
                type="button"
                disabled={submittingAction !== null}
                onClick={() => {
                  setReasonAction(null);
                  setReason("");
                  setReasonError(null);
                }}
                className="min-h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAction !== null}
                onClick={() => void submitAction(reasonAction, reason)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#14213a] px-4 text-sm font-medium text-white hover:bg-[#1c3154] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingAction === reasonAction && (
                  <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
                )}
                {submittingAction === reasonAction ? "Submitting…" : "Continue"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
