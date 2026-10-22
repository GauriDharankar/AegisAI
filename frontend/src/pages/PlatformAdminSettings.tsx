import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../services/errorMessage";
import { changePlatformAdminPassword } from "../services/authService";

export default function PlatformAdminSettings() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (!token) {
      setError("Your authenticated session is unavailable. Sign in again.");
      return;
    }

    setSaving(true);
    try {
      const result = await changePlatformAdminPassword(
        token,
        currentPassword,
        newPassword,
        confirmPassword
      );
      logout();
      navigate("/platform-admin/login", {
        replace: true,
        state: { notice: result.message },
      });
    } catch (changeError) {
      setError(getErrorMessage(changeError, "Unable to change your password."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="max-w-3xl space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Platform Super Admin</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Settings</h1>
        <p className="mt-2 text-sm text-slate-600">Manage the security of your platform account.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-800">
            <LockKeyhole size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Change Password</h2>
            <p className="mt-1 text-sm text-slate-500">Changing your password signs out all active sessions.</p>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={handleChangePassword} className="mt-6 space-y-5">
          <div>
            <label htmlFor="current-platform-password" className="mb-2 block text-sm font-medium text-slate-700">
              Current password
            </label>
            <input
              id="current-platform-password"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label htmlFor="new-platform-password" className="mb-2 block text-sm font-medium text-slate-700">
              New password
            </label>
            <input
              id="new-platform-password"
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
            <label htmlFor="confirm-platform-password" className="mb-2 block text-sm font-medium text-slate-700">
              Confirm new password
            </label>
            <input
              id="confirm-platform-password"
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
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[#15284b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#203b69] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Updating password..." : "Update password"}
          </button>
        </form>
      </div>
    </section>
  );
}
