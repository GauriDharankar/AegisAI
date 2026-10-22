import { useCallback, useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../services/errorMessage";
import {
  assignUserResponsibility,
  assignUserTeam,
  createUser,
  getTeams,
  getUsers,
  removeUserTeam,
  updateUser,
  updateUserStatus,
} from "../services/adminService";
import { useToast } from "../components/ToastProvider";
import { formatIstTimestamp } from "../utils/dateTime";

const RESPONSIBILITY_OPTIONS = [
  "TENANT_ADMIN",
  "OPERATIONS_REVIEWER",
  "RISK_REVIEWER",
  "CREDIT_COMMITTEE_REVIEWER",
  "FINAL_DECISION_MAKER",
];

export default function AdminUsers() {
  const { token, user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [teamRoles, setTeamRoles] = useState<Record<string, string>>({});
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "" });
  const [searchParams, setSearchParams] = useSearchParams();

  const loadUsers = useCallback(async () => {
    if (!token) {
      return;
    }

    const [usersResponse, teamsResponse] = await Promise.all([getUsers(token), getTeams(token)]);
    setUsers(usersResponse.data ?? []);
    setTeams(teamsResponse.data ?? []);
    setLoadError(false);
    setError(null);
  }, [token]);

  useEffect(() => {
    void loadUsers()
      .catch((loadFailure) => {
        setLoadError(true);
        setError(getErrorMessage(loadFailure, "Unable to load users and teams."));
      })
      .finally(() => setLoading(false));
  }, [loadUsers]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !name.trim() || !email.trim() || password.length < 8 || creating) {
      setError("Enter a name, valid email address, and password of at least 8 characters.");
      return;
    }

    setError(null);
    setCreating(true);
    try {
      await createUser(token, {
        name: name.trim(),
        email: email.trim(),
        password,
        status: "active",
        responsibilities: ["OPERATIONS_REVIEWER"],
      });

      setName("");
      setEmail("");
      setPassword("");
      await loadUsers();
      showToast("User created successfully");
    } catch (createError) {
      setError(getErrorMessage(createError, "Unable to create the user."));
    } finally {
      setCreating(false);
    }
  };

  const saveUser = async (userId: string) => {
    if (!token || !editForm.name.trim() || !editForm.email.trim()) {
      setError("Name and email are required.");
      return;
    }
    setUpdatingUserId(userId);
    setError(null);
    try {
      await updateUser(token, userId, { name: editForm.name.trim(), email: editForm.email.trim() });
      await loadUsers();
      setEditingUserId(null);
      showToast("User updated successfully");
    } catch (updateError) {
      setError(getErrorMessage(updateError, "Unable to update the user."));
    } finally {
      setUpdatingUserId(null);
    }
  };

  const toggleStatus = async (userId: string, currentStatus: string) => {
    if (!token) {
      return;
    }

    const nextStatus = currentStatus === "active" ? "inactive" : "active";
    const actionLabel = nextStatus === "inactive" ? "Deactivate" : "Activate";
    const confirmationMessage = nextStatus === "inactive"
      ? "This user will no longer be able to log in to the organization."
      : "This user will regain access to the organization.";

    if (!window.confirm(`${actionLabel} User?\n\n${confirmationMessage}`)) {
      return;
    }

    setUpdatingUserId(userId);
    setError(null);
    try {
      await updateUserStatus(token, userId, nextStatus);
      await loadUsers();
      showToast(nextStatus === "inactive" ? "User deactivated successfully" : "User activated successfully");
    } catch (statusError) {
      setError(getErrorMessage(statusError, "Unable to update user status."));
    } finally {
      setUpdatingUserId(null);
    }
  };

  const updateResponsibility = async (userId: string, responsibility: string) => {
    if (!token || !responsibility) {
      return;
    }

    setUpdatingUserId(userId);
    setError(null);
    try {
      await assignUserResponsibility(token, userId, { responsibility });
      await loadUsers();
      showToast("Responsibility updated successfully");
    } catch (responsibilityError) {
      setError(getErrorMessage(responsibilityError, "Unable to update user responsibility."));
    } finally {
      setUpdatingUserId(null);
    }
  };

  const addTeam = async (userId: string, teamId: string) => {
    if (!token || !teamId) {
      return;
    }

    setUpdatingUserId(userId);
    setError(null);
    try {
      await assignUserTeam(token, userId, {
        team_id: teamId,
        role: teamRoles[userId] || "OPERATIONS_REVIEWER",
      });
      await loadUsers();
      showToast("Team assigned successfully");
    } catch (teamError) {
      setError(getErrorMessage(teamError, "Unable to assign the selected team."));
    } finally {
      setUpdatingUserId(null);
    }
  };

  const removeTeam = async (userId: string, teamId: string) => {
    if (!token) {
      return;
    }
    if (!window.confirm("Remove this user from the selected team?")) {
      return;
    }

    setUpdatingUserId(userId);
    setError(null);
    try {
      await removeUserTeam(token, userId, teamId);
      await loadUsers();
      showToast("Team assignment removed");
    } catch (removeError) {
      setError(getErrorMessage(removeError, "Unable to remove the team assignment."));
    } finally {
      setUpdatingUserId(null);
    }
  };

  const updateTeamRole = async (userId: string, teamId: string, role: string) => {
    if (!token || !role) {
      return;
    }

    setUpdatingUserId(userId);
    setError(null);
    try {
      await assignUserTeam(token, userId, { team_id: teamId, role });
      await loadUsers();
      showToast("Team responsibility updated");
    } catch (roleError) {
      setError(getErrorMessage(roleError, "Unable to update the team responsibility."));
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Tenant Admin</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Users</h1>
      </div>

      <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
            <UserPlus size={18} />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Add user</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Full name</label>
            <input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
            <input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </div>
        </div>
        <button type="submit" disabled={creating} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60">{creating ? "Adding…" : "Add user"}</button>
      </form>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          {loadError && <button type="button" onClick={() => { setLoading(true); setLoadError(false); void loadUsers().catch((loadFailure) => { setLoadError(true); setError(getErrorMessage(loadFailure, "Unable to load users and teams.")); }).finally(() => setLoading(false)); }} disabled={loading} className="font-medium underline disabled:opacity-50">Retry loading</button>}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">User directory</h2>
          <div className="flex gap-2">
            <input
              type="search"
              aria-label="Search users"
              placeholder="Search users..."
              value={searchParams.get("search") ?? ""}
              onChange={(event) => setSearchParams((current) => {
                const next = new URLSearchParams(current);
                if (event.target.value) next.set("search", event.target.value);
                else next.delete("search");
                return next;
              })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              aria-label="Filter users by status"
              value={searchParams.get("status") ?? ""}
              onChange={(event) => setSearchParams((current) => {
                const next = new URLSearchParams(current);
                if (event.target.value) next.set("status", event.target.value);
                else next.delete("status");
                return next;
              })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-slate-600">Loading users…</div>
        ) : (
          (() => {
            const query = (searchParams.get("search") ?? "").trim().toLowerCase();
            const statusFilter = searchParams.get("status");
            const filteredUsers = users.filter((candidate) => {
              const matchesSearch = !query || [candidate.name, candidate.email, candidate.primary_role, ...(candidate.teams ?? []).map((team: any) => team.name)]
                .some((value) => String(value ?? "").toLowerCase().includes(query));
              return matchesSearch && (!statusFilter || candidate.status === statusFilter);
            });
            return filteredUsers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                {users.length === 0 ? "No users found. Add a user to get started." : "No users match these filters."}
              </div>
            ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-[760px] divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Team</th>
                  <th className="px-4 py-3 font-medium">Responsibility</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredUsers.map((user) => {
                  const isCurrentAdmin = currentUser?.id === user.id;
                  const statusLabel = (user.status || "active").toUpperCase();

                  return (
                    <tr key={user.id}>
                      <td className="px-4 py-3">
                        {editingUserId === user.id ? (
                          <div className="space-y-2">
                            <input aria-label={`Name for ${user.email}`} value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded border border-slate-300 px-2 py-1" />
                            <input aria-label={`Email for ${user.name}`} type="email" value={editForm.email} onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))} className="w-full rounded border border-slate-300 px-2 py-1" />
                            <div className="flex gap-2">
                              <button type="button" onClick={() => void saveUser(user.id)} disabled={updatingUserId === user.id} className="text-xs font-medium text-teal-700 disabled:opacity-50">Save</button>
                              <button type="button" onClick={() => setEditingUserId(null)} disabled={updatingUserId === user.id} className="text-xs text-slate-500">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div>
                          <p className="font-medium text-slate-800">{user.name}</p>
                          <p className="text-xs text-slate-500">{formatIstTimestamp(user.created_at, "New user")}</p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {editingUserId === user.id ? "Editing above" : user.email}
                        {editingUserId !== user.id && <button type="button" onClick={() => { setEditingUserId(user.id); setEditForm({ name: user.name, email: user.email }); }} disabled={updatingUserId === user.id} className="ml-2 text-xs font-medium text-teal-700">Edit</button>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${user.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                            {statusLabel}
                          </span>
                          {isCurrentAdmin && (
                            <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                              Current Admin
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="space-y-2">
                          {user.teams?.length ? user.teams.map((team: any) => (
                            <div key={team.id} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span>{team.name}</span>
                                <button
                                  type="button"
                                  onClick={() => void removeTeam(user.id, team.id)}
                                  disabled={updatingUserId === user.id}
                                  className="text-xs text-red-600 disabled:opacity-50"
                                >
                                  Remove
                                </button>
                              </div>
                              <select
                                value={(team.role ?? "Operations Reviewer").toUpperCase().replaceAll(" ", "_")}
                                disabled={updatingUserId === user.id}
                                onChange={(event) => void updateTeamRole(user.id, team.id, event.target.value)}
                                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                                aria-label={`${team.name} responsibility for ${user.name}`}
                              >
                                {RESPONSIBILITY_OPTIONS.filter((option) => option !== "TENANT_ADMIN").map((option) => (
                                  <option key={option} value={option}>{option.replaceAll("_", " ")}</option>
                                ))}
                              </select>
                            </div>
                          )) : <span>No team</span>}
                          <select
                            value={teamRoles[user.id] ?? "OPERATIONS_REVIEWER"}
                            disabled={updatingUserId === user.id}
                            onChange={(event) => setTeamRoles((current) => ({ ...current, [user.id]: event.target.value }))}
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            aria-label={`Responsibility for ${user.name}'s next team assignment`}
                          >
                            {RESPONSIBILITY_OPTIONS.filter((option) => option !== "TENANT_ADMIN").map((option) => (
                              <option key={option} value={option}>{option.replaceAll("_", " ")}</option>
                            ))}
                          </select>
                          <select
                            defaultValue=""
                            disabled={updatingUserId === user.id || teams.length === 0}
                            onChange={(event) => {
                              void addTeam(user.id, event.target.value);
                              event.target.value = "";
                            }}
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                          >
                            <option value="">Assign team...</option>
                            {teams.filter((team) => team.status === "active")
                              .filter((team) => !(user.teams ?? []).some((assigned: any) => assigned.id === team.id))
                              .map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <select
                          value={(user.primary_role ?? "").toUpperCase().replaceAll(" ", "_")}
                          disabled={updatingUserId === user.id}
                          onChange={(event) => void updateResponsibility(user.id, event.target.value)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                        >
                          {RESPONSIBILITY_OPTIONS.map((option) => {
                            const label = option.replaceAll("_", " ");
                            return <option key={option} value={option}>{label}</option>;
                          })}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {isCurrentAdmin ? (
                          <span className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700">
                            Current Admin
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void toggleStatus(user.id, user.status)}
                            disabled={updatingUserId === user.id}
                            className="rounded border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {user.status === "active" ? "Deactivate" : "Activate"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
