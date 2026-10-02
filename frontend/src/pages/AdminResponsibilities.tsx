import { useEffect, useMemo, useState } from "react";
import { Award, BriefcaseBusiness } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { assignUserResponsibility, getUsers } from "../services/adminService";
import { getErrorMessage } from "../services/errorMessage";
import { useToast } from "../components/ToastProvider";

const RESPONSIBILITY_OPTIONS = [
  "TENANT_ADMIN",
  "OPERATIONS_REVIEWER",
  "RISK_REVIEWER",
  "CREDIT_COMMITTEE_REVIEWER",
  "FINAL_DECISION_MAKER",
];

export default function AdminResponsibilities() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [responsibility, setResponsibility] = useState("OPERATIONS_REVIEWER");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = async () => {
    if (!token) {
      return;
    }

    const response = await getUsers(token);
    setUsers(response.data ?? []);
    if (!selectedUserId && response.data?.length) {
      setSelectedUserId(response.data[0].id);
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadUsers().finally(() => setLoading(false));
  }, [token]);

  const responsibilitySummary = useMemo(() => {
    return users
      .flatMap((user) =>
        (user.responsibilities ?? []).map((item: string) => ({
          user: user.name,
          responsibility: item,
        }))
      )
      .slice(0, 12);
  }, [users]);

  const selectedUser = users.find((user) => user.id === selectedUserId) ?? users[0] ?? null;

  const handleAssign = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !selectedUserId || !responsibility) {
      return;
    }

    setSubmitting(true);
    try {
      await assignUserResponsibility(token, selectedUserId, { responsibility });
      await loadUsers();
      showToast("Responsibility updated successfully");
    } catch (error) {
      showToast(getErrorMessage(error, "Unable to update responsibility"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Tenant Admin</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Responsibilities</h1>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">Loading responsibilities…</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]">
          <form onSubmit={handleAssign} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
                <Award size={18} />
              </div>
              <h2 className="text-xl font-semibold text-slate-900">Assign responsibility</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">User</label>
                <select
                  value={selectedUserId}
                  onChange={(event) => setSelectedUserId(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-700"
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Responsibility</label>
                <select
                  value={responsibility}
                  onChange={(event) => setResponsibility(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-700"
                >
                  {RESPONSIBILITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                <strong className="text-slate-800">Current user:</strong> {selectedUser?.name ?? "—"}
              </div>

              <button
                type="submit"
                disabled={submitting || !selectedUserId}
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Assigning…" : "Assign responsibility"}
              </button>
            </div>
          </form>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                <BriefcaseBusiness size={18} />
              </div>
              <h2 className="text-xl font-semibold text-slate-900">Responsibility map</h2>
            </div>

            {responsibilitySummary.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                No responsibilities assigned yet.
              </div>
            ) : (
              <div className="space-y-3">
                {responsibilitySummary.map((entry, index) => (
                  <div key={`${entry.user}-${entry.responsibility}-${index}`} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                    <div>
                      <p className="font-medium text-slate-800">{entry.user}</p>
                      <p className="text-sm text-slate-500">User responsibility</p>
                    </div>
                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                      {entry.responsibility}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
