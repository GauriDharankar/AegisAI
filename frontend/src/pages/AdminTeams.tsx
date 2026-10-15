import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { createTeam, getTeams, updateTeam } from "../services/adminService";
import { getErrorMessage } from "../services/errorMessage";
import { useToast } from "../components/ToastProvider";

export default function AdminTeams() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [teams, setTeams] = useState<any[]>([]);
  const [teamName, setTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [savingTeamId, setSavingTeamId] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamDraft, setTeamDraft] = useState({ name: "", description: "", status: "active" });
  const [searchParams, setSearchParams] = useSearchParams();

  const loadTeams = async () => {
    if (!token) {
      return;
    }

    const response = await getTeams(token);
    setTeams(response.data ?? []);
    setError(null);
  };

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadTeams()
      .catch((loadError) => setError(getErrorMessage(loadError, "Unable to load teams.")))
      .finally(() => setLoading(false));
  }, [token]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || teamName.trim().length < 2 || creating) {
      setError("Team name must contain at least 2 characters.");
      return;
    }

    setError(null);
    setCreating(true);
    try {
      await createTeam(token, {
        name: teamName.trim(),
        description,
        status: "active",
      });
      setTeamName("");
      setDescription("");
      await loadTeams();
      showToast("Team created successfully");
    } catch (createError) {
      setError(getErrorMessage(createError, "Unable to create the team."));
    } finally {
      setCreating(false);
    }
  };

  const saveTeam = async (teamId: string) => {
    if (!token || teamDraft.name.trim().length < 2 || savingTeamId) {
      setError("Team name must contain at least 2 characters.");
      return;
    }
    const currentTeam = teams.find((team) => team.id === teamId);
    if (currentTeam?.status === "active" && teamDraft.status === "inactive" &&
      !window.confirm("Deactivate this team? It cannot be newly assigned while inactive; active workflow and routing assignments must be removed first.")) {
      return;
    }
    setSavingTeamId(teamId);
    setError(null);
    try {
      await updateTeam(token, teamId, {
        name: teamDraft.name.trim(),
        description: teamDraft.description.trim(),
        status: teamDraft.status,
      });
      await loadTeams();
      setEditingTeamId(null);
      showToast("Team updated successfully");
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Unable to update the team."));
    } finally {
      setSavingTeamId(null);
    }
  };

  const search = (searchParams.get("search") ?? "").trim().toLowerCase();
  const filteredTeams = teams.filter((team) =>
    !search || `${team.name} ${team.description ?? ""} ${team.status}`.toLowerCase().includes(search)
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Tenant Admin</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Teams</h1>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => { setLoading(true); void loadTeams().catch((loadError) => setError(getErrorMessage(loadError, "Unable to load teams."))).finally(() => setLoading(false)); }} disabled={loading} className="font-medium underline disabled:opacity-50">Retry</button>
        </div>
      )}

      <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
            <Plus size={18} />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Create team</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Team name</label>
            <input
              required
              minLength={2}
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Description</label>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
        </div>

        <button type="submit" disabled={creating} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {creating ? "Creating…" : "Create team"}
        </button>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">Team directory</h2>
          <input
            type="search"
            aria-label="Search teams"
            placeholder="Search teams..."
            value={searchParams.get("search") ?? ""}
            onChange={(event) => setSearchParams((current) => {
              const next = new URLSearchParams(current);
              if (event.target.value) next.set("search", event.target.value);
              else next.delete("search");
              return next;
            })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {loading ? (
          <div className="text-slate-600">Loading teams…</div>
        ) : filteredTeams.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              {teams.length === 0 ? "No teams yet. Create a team to get started." : "No teams match this search."}
            </div>
          ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredTeams.map((team) => (
              <div key={team.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    {editingTeamId === team.id ? (
                      <div className="space-y-2">
                        <input aria-label="Team name" required minLength={2} value={teamDraft.name} onChange={(event) => setTeamDraft((current) => ({ ...current, name: event.target.value }))} className="w-full rounded border border-slate-300 px-2 py-1 font-semibold" />
                        <input aria-label="Team description" value={teamDraft.description} onChange={(event) => setTeamDraft((current) => ({ ...current, description: event.target.value }))} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                        <select aria-label="Team status" value={teamDraft.status} onChange={(event) => setTeamDraft((current) => ({ ...current, status: event.target.value }))} className="rounded border border-slate-300 px-2 py-1 text-sm">
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    ) : (
                      <>
                        <p className="font-semibold text-slate-900">{team.name}</p>
                        <p className="text-sm text-slate-500">{team.description || "No description"}</p>
                      </>
                    )}
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${team.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                    {team.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                  <span>Members: {team.member_count}</span>
                  <span>{team.members?.length ?? 0} assigned</span>
                </div>
                <div className="mt-3 flex justify-end gap-3">
                  {editingTeamId === team.id ? (
                    <>
                      <button type="button" onClick={() => void saveTeam(team.id)} disabled={savingTeamId === team.id} className="text-sm font-medium text-teal-700 disabled:opacity-50">{savingTeamId === team.id ? "Saving…" : "Save"}</button>
                      <button type="button" onClick={() => setEditingTeamId(null)} disabled={savingTeamId === team.id} className="text-sm text-slate-500">Cancel</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => { setEditingTeamId(team.id); setTeamDraft({ name: team.name, description: team.description ?? "", status: team.status }); }} className="text-sm font-medium text-teal-700">Edit team</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          )}
      </div>
    </div>
  );
}
