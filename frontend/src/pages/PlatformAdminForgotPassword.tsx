import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { getErrorMessage } from "../services/errorMessage";
import {
  confirmPlatformAdminPasswordReset,
  startPlatformAdminPasswordReset,
  verifyPlatformAdminPasswordResetCode,
} from "../services/authService";

type ResetStep = "phone" | "code" | "password";

export default function PlatformAdminForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<ResetStep>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [developmentCode, setDevelopmentCode] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const runRequest = async (request: () => Promise<void>) => {
    setError("");
    setNotice("");
    setLoading(true);
    try {
      await request();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to complete password recovery."));
    } finally {
      setLoading(false);
    }
  };

  const requestCode = () => runRequest(async () => {
    const result = await startPlatformAdminPasswordReset(phoneNumber.trim());
    setDevelopmentCode(result.development_otp ?? "");
    setNotice(result.message);
    setStep("code");
  });

  const verifyCode = () => runRequest(async () => {
    const result = await verifyPlatformAdminPasswordResetCode(phoneNumber.trim(), code.trim());
    setResetToken(result.reset_token);
    setStep("password");
  });

  const resetPassword = () => runRequest(async () => {
    const result = await confirmPlatformAdminPasswordReset(resetToken, newPassword, confirmPassword);
    navigate("/platform-admin/login", { replace: true, state: { notice: result.message } });
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b1426] px-5 py-12">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl sm:p-10">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8efff] text-[#243f78]">
            <ShieldCheck size={25} aria-hidden="true" />
          </span>
          <div>
            <p className="text-xl font-bold tracking-tight text-slate-900">AegisAI</p>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Platform Console</p>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
        <p className="mt-2 text-sm text-slate-500">
          Verify the mobile number registered to your Platform Super Admin account.
        </p>

        {notice && <p role="status" className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{notice}</p>}
        {developmentCode && (
          <p role="status" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Development-only test OTP: <strong>{developmentCode}</strong>
          </p>
        )}
        {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {step === "phone" && (
          <form onSubmit={(event) => { event.preventDefault(); requestCode(); }} className="mt-7 space-y-5">
            <div>
              <label htmlFor="registered-phone" className="mb-2 block text-sm font-medium text-slate-700">
                Registered mobile number
              </label>
              <input
                id="registered-phone"
                type="tel"
                autoComplete="tel"
                required
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="+14155550123"
                className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
              <p className="mt-2 text-xs text-slate-500">Use the number in international format, including the country code.</p>
            </div>
            <button disabled={loading} className="w-full rounded-lg bg-[#15284b] py-3 font-semibold text-white hover:bg-[#203b69] disabled:opacity-60">
              {loading ? "Requesting code..." : "Send verification code"}
            </button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={(event) => { event.preventDefault(); verifyCode(); }} className="mt-7 space-y-5">
            <div>
              <label htmlFor="reset-code" className="mb-2 block text-sm font-medium text-slate-700">Six-digit verification code</label>
              <input
                id="reset-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm tracking-[0.3em] outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <button disabled={loading} className="w-full rounded-lg bg-[#15284b] py-3 font-semibold text-white hover:bg-[#203b69] disabled:opacity-60">
              {loading ? "Verifying..." : "Verify code"}
            </button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={(event) => { event.preventDefault(); resetPassword(); }} className="mt-7 space-y-5">
            <div>
              <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-slate-700">New password</label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label htmlFor="confirm-new-password" className="mb-2 block text-sm font-medium text-slate-700">Confirm new password</label>
              <input
                id="confirm-new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <p className="text-xs text-slate-500">At least 8 characters, including uppercase, lowercase, and a number.</p>
            <button disabled={loading} className="w-full rounded-lg bg-[#15284b] py-3 font-semibold text-white hover:bg-[#203b69] disabled:opacity-60">
              {loading ? "Resetting password..." : "Reset password"}
            </button>
          </form>
        )}

        <Link to="/platform-admin/login" className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Super Admin sign in
        </Link>
      </section>
    </main>
  );
}
