import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../services/errorMessage";
import {
  assignUserResponsibility,
  assignUserTeam,
  createUser,
  getTeams,
  getUsers,
  removeUserTeam,
  updateUserStatus,
} from "../services/adminService";

const RESPONSIBILITY_OPTIONS = [
  "TENANT_ADMIN",
  "OPERATIONS_REVIEWER",
  "RISK_REVIEWER",
  "CREDIT_COMMITTEE_REVIEWER",
  "FINAL_DECISION_MAKER",
];

export default function AdminUsers() {
  const { token } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("SecurePass123");
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [teamRoles, setTeamRoles] = useState<Record<string, string>>({});

  const loadUsers = async () => {
    if (!token) {
      return;
    }

    const [usersResponse, teamsResponse] = await Promise.all([getUsers(token), getTeams(token)]);
    setUsers(usersResponse.data ?? []);
    setTeams(teamsResponse.data ?? []);
  };

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadUsers()
      .catch((loadError) => setError(getErrorMessage(loadError, "Unable to load users and teams.")))
      .finally(() => setLoading(false));
  }, [token]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      return;
    }

    setError(null);
    try {
      await createUser(token, {
        name,
        email,
        password,
        status: "active",
        responsibilities: ["OPERATIONS_REVIEWER"],
      });

      setName("");
      setEmail("");
      setPassword("SecurePass123");
      await loadUsers();
    } catch (createError) {
      setError(getErrorMessage(createError, "Unable to create the user."));
    }
  };

  const toggleStatus = async (userId: string, currentStatus: string) => {
    if (!token) {
      return;
    }

    const nextStatus = currentStatus === "active" ? "inactive" : "active";
    setUpdatingUserId(userId);
    setError(null);
    try {
      await updateUserStatus(token, userId, nextStatus);
      await loadUsers();
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

    setUpdatingUserId(userId);
    setError(null);
    try {
      await removeUserTeam(token, userId, teamId);
      await loadUsers();
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
            <input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
            <input value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
            <input value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </div>
        </div>
        <button type="submit" className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Add user</button>
      </form>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">User directory</h2>

        {loading ? (
          <div className="text-slate-600">Loading users…</div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
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
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-800">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.created_at ? new Date(user.created_at).toLocaleDateString() : "New user"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${user.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                        {user.status}
                      </span>
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
                          {teams
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
                      <button
                        type="button"
                        onClick={() => void toggleStatus(user.id, user.status)}
                        disabled={updatingUserId === user.id}
                        className="rounded border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700"
                      >
                        {user.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
