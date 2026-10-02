import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getTeams, getWorkflow, updateWorkflow } from "../services/adminService";

const STAGE_TYPE_OPTIONS = [
  "OPERATIONS_REVIEW",
  "RISK_REVIEW",
  "CREDIT_COMMITTEE_REVIEW",
  "FINAL_DECISION",
];

interface WorkflowStageRow {
  id?: string;
  stage_type: string;
  team_id: string | null;
  status: "active" | "inactive";
  stage_order: number;
  team_name?: string | null;
}

interface WorkflowRecord {
  id?: string;
  name: string;
  status: "active" | "inactive";
  stages: WorkflowStageRow[];
}

export default function AdminWorkflow() {
  const { token } = useAuth();
  const [teams, setTeams] = useState<any[]>([]);
  const [workflow, setWorkflow] = useState<WorkflowRecord>({
    name: "Default Governance Workflow",
    status: "active",
    stages: [],
  });
  const [loading, setLoading] = useState(true);

  const availableStages = useMemo(
    () => workflow.stages.map((stage) => stage.stage_type),
    [workflow.stages]
  );

  const loadData = async () => {
    if (!token) {
      return;
    }

    const [teamResponse, workflowResponse] = await Promise.all([
      getTeams(token),
      getWorkflow(token),
    ]);

    setTeams(teamResponse.data ?? []);
    setWorkflow({
      name: workflowResponse.data?.name ?? "Default Governance Workflow",
      status: workflowResponse.data?.status ?? "active",
      stages: (workflowResponse.data?.stages ?? []).map((stage: any, index: number) => ({
        id: stage.id,
        stage_type: stage.stage_type,
        team_id: stage.team_id ?? null,
        status: stage.status,
        stage_order: stage.stage_order ?? index + 1,
        team_name: stage.team_name,
      })),
    });
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, [token]);

  const updateStage = <K extends keyof WorkflowStageRow>(
    index: number,
    field: K,
    value: WorkflowStageRow[K]
  ) => {
    setWorkflow((current) => ({
      ...current,
      stages: current.stages.map((stage, stageIndex) =>
        stageIndex === index ? { ...stage, [field]: value } : stage
      ),
    }));
  };

  const addStage = () => {
    setWorkflow((current) => ({
      ...current,
      stages: [
        ...current.stages,
        {
          stage_type: STAGE_TYPE_OPTIONS[0],
          team_id: teams[0]?.id ?? null,
          status: "active",
          stage_order: current.stages.length + 1,
        },
      ],
    }));
  };

  const removeStage = (index: number) => {
    setWorkflow((current) => ({
      ...current,
      stages: current.stages
        .filter((_, stageIndex) => stageIndex !== index)
        .map((stage, stageIndex) => ({ ...stage, stage_order: stageIndex + 1 })),
    }));
  };

  const moveStage = (index: number, direction: -1 | 1) => {
    setWorkflow((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.stages.length) {
        return current;
      }

      const reordered = [...current.stages];
      [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];

      return {
        ...current,
        stages: reordered.map((stage, stageIndex) => ({
          ...stage,
          stage_order: stageIndex + 1,
        })),
      };
    });
  };

  const handleSave = async () => {
    if (!token) {
      return;
    }

    const payload = {
      name: workflow.name.trim() || "Default Governance Workflow",
      status: workflow.status,
      stages: workflow.stages.map((stage, index) => ({
        stage_type: stage.stage_type,
        team_id: stage.team_id || null,
        status: stage.status,
        stage_order: index + 1,
      })),
    };

    await updateWorkflow(token, payload);
    await loadData();
  };

  if (loading) {
    return <p>Loading workflow...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Tenant Admin</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Governance Workflow</h1>
        <p className="mt-2 text-slate-600">
          Current workflow for the authenticated tenant. The number of stages and assignments come from the tenant’s configured workflow, not a fixed four-level model.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Current tenant workflow</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            {workflow.stages.length} stage{workflow.stages.length === 1 ? "" : "s"}
          </span>
        </div>

        {workflow.stages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
            No stages are configured for this tenant yet.
          </div>
        ) : (
          <div className="space-y-3">
            {workflow.stages.map((stage, index) => (
              <div key={`${stage.stage_type}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">{stage.stage_type}</p>
                      <p className="text-sm text-slate-500">{stage.team_name ?? "No team assigned"}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                    {stage.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Workflow name</label>
            <input
              value={workflow.name}
              onChange={(event) => setWorkflow((current) => ({ ...current, name: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Status</label>
            <select
              value={workflow.status}
              onChange={(event) => setWorkflow((current) => ({ ...current, status: event.target.value as "active" | "inactive" }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Stages</h2>
            <button
              type="button"
              onClick={addStage}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white"
            >
              Add stage
            </button>
          </div>

          {workflow.stages.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
              No workflow stages configured yet.
            </p>
          ) : (
            workflow.stages.map((stage, index) => (
              <div key={`${stage.stage_type}-${index}`} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Stage {index + 1}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => moveStage(index, -1)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600"
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStage(index, 1)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600"
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStage(index)}
                      className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Stage type</label>
                    <select
                      value={stage.stage_type}
                      onChange={(event) => updateStage(index, "stage_type", event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    >
                      {STAGE_TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Team</label>
                    <select
                      value={stage.team_id ?? ""}
                      onChange={(event) => updateStage(index, "team_id", event.target.value || null)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    >
                      <option value="">No team</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Status</label>
                    <select
                      value={stage.status}
                      onChange={(event) => updateStage(index, "status", event.target.value as "active" | "inactive")}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
          <div className="text-sm text-slate-500">
            {availableStages.length > 0 ? `${availableStages.length} stages configured` : "No stages configured"}
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Save workflow
          </button>
        </div>
      </div>
    </div>
  );
}
