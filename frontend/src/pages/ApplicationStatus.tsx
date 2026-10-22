import { AlertCircle, CheckCircle2, Clock3, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { getAuthenticatedDestination } from "../services/authService";
import { getErrorMessage } from "../services/errorMessage";
import { formatIstTimestamp } from "../utils/dateTime";

const submittedMessage =
  "Your organization registration application has been submitted successfully and is currently under review by our Platform Super Admin. You will receive an update once the verification process is complete.";

function formatStatus(status: string | undefined): string {
  if (!status) return "Status unavailable";
  return status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function ApplicationStatus() {
  const { user, logout, refreshStatus } = useAuth();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");

  if (!user) return null;

  const verificationStatus = user.verification_status?.toUpperCase();
  const accountInactive = user.tenant_status != null
    && user.tenant_status.toLowerCase() !== "active";
  const isRejected = verificationStatus === "REJECTED";
  const needsInformation = verificationStatus === "INFORMATION_REQUIRED";
  const isPending = verificationStatus === "PENDING" || verificationStatus === "UNDER_REVIEW";
  const statusUnknown = verificationStatus === "UNKNOWN"
    || !verificationStatus
    || user.tenant_status == null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshError("");
    try {
      const latestUser = await refreshStatus();
      if (getAuthenticatedDestination(latestUser) === "/dashboard") {
        navigate("/dashboard", { replace: true });
      }
    } catch (error) {
      setRefreshError(getErrorMessage(error, "The organization status could not be refreshed. Please try again."));
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  let statusMessage = submittedMessage;
  let statusTone = "border-blue-200 bg-blue-50 text-blue-800";
  let StatusIcon = Clock3;

  if (statusUnknown) {
    statusMessage = "Your organization status could not be confirmed. Refresh the status to reconnect with the verification service.";
    statusTone = "border-amber-200 bg-amber-50 text-amber-900";
    StatusIcon = AlertCircle;
  } else if (accountInactive) {
    statusMessage = "This organization account is inactive. Contact Platform Support if you believe this is an error.";
    statusTone = "border-slate-200 bg-slate-100 text-slate-800";
    StatusIcon = AlertCircle;
  } else if (isRejected) {
    statusMessage = "The organization registration application was not approved.";
    statusTone = "border-red-200 bg-red-50 text-red-800";
    StatusIcon = AlertCircle;
  } else if (needsInformation) {
    statusMessage = "The Platform Super Admin requires additional information before verification can continue.";
    statusTone = "border-orange-200 bg-orange-50 text-orange-900";
    StatusIcon = AlertCircle;
  } else if (!isPending && verificationStatus === "VERIFIED") {
    statusMessage = "Your organization has been verified, but its account is not active yet. Contact Platform Support for assistance.";
    statusTone = "border-amber-200 bg-amber-50 text-amber-900";
    StatusIcon = AlertCircle;
  } else if (!isPending) {
    statusMessage = "Your organization status is not recognized. Contact Platform Support for assistance.";
    statusTone = "border-amber-200 bg-amber-50 text-amber-900";
    StatusIcon = AlertCircle;
  } else if (verificationStatus === "UNDER_REVIEW") {
    statusMessage = "Your organization application is being reviewed by our Platform Super Admin. You will receive an update once the verification process is complete.";
    statusTone = "border-blue-200 bg-blue-50 text-blue-800";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
        <header className="flex items-center gap-3 bg-slate-900 px-8 py-6 text-white">
          <span className="rounded-xl bg-blue-600 p-3">
            <ShieldCheck size={26} />
          </span>
          <div>
            <p className="text-xl font-bold">AegisAI</p>
            <p className="text-sm text-slate-300">Organization verification</p>
          </div>
        </header>

        <div className="space-y-7 p-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Application status</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              {isPending ? "Application Submitted — Under Review" : formatStatus(verificationStatus)}
            </h1>
          </div>

          <div className={`flex gap-3 rounded-xl border p-4 ${statusTone}`}>
            <StatusIcon className="mt-0.5 shrink-0" size={21} />
            <p className="text-sm leading-6">{statusMessage}</p>
          </div>

          {(isRejected || needsInformation) && user.verification_reason && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="text-sm font-semibold text-slate-800">
                {needsInformation ? "Information required" : "Review reason"}
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{user.verification_reason}</p>
            </div>
          )}

          <dl className="grid gap-4 rounded-xl border border-slate-200 p-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Organization</dt>
              <dd className="mt-1 font-semibold text-slate-900">{user.tenant_name || "Not available"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Application reference</dt>
              <dd className="mt-1 break-all font-mono text-sm text-slate-800">{user.tenant_id || "Not available"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Submitted</dt>
              <dd className="mt-1 text-sm text-slate-800">{formatIstTimestamp(user.tenant_created_at)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Current status</dt>
              <dd className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                {verificationStatus === "VERIFIED" && !accountInactive
                  ? <CheckCircle2 size={16} className="text-emerald-600" />
                  : <Clock3 size={16} className="text-slate-500" />}
                {accountInactive ? "Account Inactive" : formatStatus(verificationStatus)}
              </dd>
            </div>
          </dl>

          {refreshError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {refreshError}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <LogOut size={17} />
              Log out
            </button>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={17} className={isRefreshing ? "animate-spin" : ""} />
              {isRefreshing ? "Checking status..." : "Refresh status"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
