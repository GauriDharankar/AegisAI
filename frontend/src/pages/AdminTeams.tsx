import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { createTeam, getTeams } from "../services/adminService";
import { getErrorMessage } from "../services/errorMessage";

export default function AdminTeams() {
  const { token } = useAuth();
  const [teams, setTeams] = useState<any[]>([]);
  const [teamName, setTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTeams = async () => {
    if (!token) {
      return;
    }

    const response = await getTeams(token);
    setTeams(response.data ?? []);
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
    if (!token || !teamName.trim()) {
      return;
    }

    setError(null);
    try {
      await createTeam(token, {
        name: teamName,
        description,
        status: "active",
      });
      setTeamName("");
      setDescription("");
      await loadTeams();
    } catch (createError) {
      setError(getErrorMessage(createError, "Unable to create the team."));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Tenant Admin</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Teams</h1>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

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

        <button type="submit" className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Create team
        </button>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Team directory</h2>

        {loading ? (
          <div className="text-slate-600">Loading teams…</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {teams.map((team) => (
              <div key={team.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">{team.name}</p>
                    <p className="text-sm text-slate-500">{team.description || "No description"}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${team.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                    {team.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                  <span>Members: {team.member_count}</span>
                  <span>{team.members?.length ?? 0} assigned</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
