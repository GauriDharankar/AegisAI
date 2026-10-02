import { useEffect, useState } from "react";
import {
  Building2,
  ClipboardCheck,
  GitBranch,
  ShieldCheck,
  Users,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { getOrganization, getTeams, getUsers, getWorkflow } from "../services/adminService";

interface WorkflowStageSummary {
  id?: string;
  stage_type: string;
  team_name?: string | null;
  status: string;
  stage_order: number;
}

export default function AdminDashboard() {
  const { token, user } = useAuth();
  const [organization, setOrganization] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [workflow, setWorkflow] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      return;
    }

    Promise.all([
      getOrganization(token),
      getUsers(token),
      getTeams(token),
      getWorkflow(token),
    ])
      .then(([orgResponse, usersResponse, teamsResponse, workflowResponse]) => {
        setOrganization(orgResponse.data);
        setUsers(usersResponse.data ?? []);
        setTeams(teamsResponse.data ?? []);
        setWorkflow(workflowResponse.data ?? null);
      })
      .catch(() => {
        setOrganization(null);
        setUsers([]);
        setTeams([]);
        setWorkflow(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const activeWorkflowStages = (workflow?.stages ?? []) as WorkflowStageSummary[];
  const pendingReviews = users.filter((candidate) => candidate.status === "active").length;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Tenant Admin</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Organization Dashboard</h1>
        <p className="mt-2 text-slate-600">
          {organization?.organization_name ?? user?.tenant_name ?? "Current tenant"} · {user?.name ?? "Admin"}
        </p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-slate-600">Loading tenant dashboard…</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard title="Total Users" value={users.length} icon={<Users size={18} />} />
            <StatCard title="Total Teams" value={teams.length} icon={<Building2 size={18} />} />
            <StatCard title="Active Workflow" value={workflow ? "Live" : "Not set"} icon={<GitBranch size={18} />} />
            <StatCard title="Applications" value="0" description="API pending Phase 5" icon={<ClipboardCheck size={18} />} />
            <StatCard title="Pending Reviews" value={String(pendingReviews)} icon={<ShieldCheck size={18} />} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Current Governance Workflow</h2>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  {workflow?.status ?? "inactive"}
                </span>
              </div>

              {activeWorkflowStages.length > 0 ? (
                <div className="space-y-3">
                  {activeWorkflowStages.map((stage, index) => (
                    <div key={`${stage.stage_type}-${index}`} className="flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium text-slate-800">{stage.stage_type}</p>
                        <p className="text-sm text-slate-500">{stage.team_name ?? "Team not assigned"}</p>
                      </div>
                      <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-700">
                        {stage.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  No workflow stages configured yet.
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-lg font-semibold text-slate-900">Organization Summary</h2>
              <dl className="space-y-4 text-sm">
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-slate-500">Organization</dt>
                  <dd className="mt-1 font-semibold text-slate-900">{organization?.organization_name ?? "Unassigned"}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-slate-500">Status</dt>
                  <dd className="mt-1 font-semibold text-slate-900">{organization?.status ?? "active"}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-slate-500">Tenant ID</dt>
                  <dd className="mt-1 font-semibold text-slate-900">{organization?.id ?? user?.tenant_id ?? "—"}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Recent Activity</h2>
              <div className="space-y-3 text-sm text-slate-600">
                <ActivityRow label="Organization profile" value={organization ? "Synced" : "Awaiting sync"} />
                <ActivityRow label="Team assignments" value={`${teams.length} active teams`} />
                <ActivityRow label="User roster" value={`${users.length} tenant users`} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Pending Actions</h2>
              <div className="space-y-3 text-sm text-slate-600">
                <ActionRow text="Review workflow stage assignments" status="In progress" />
                <ActionRow text="Confirm team membership" status="Ready" />
                <ActionRow text="Validate governance statuses" status="Scheduled" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{title}</p>
        <div className="rounded-lg bg-slate-100 p-2 text-slate-700">{icon}</div>
      </div>
      <div className="mt-4 text-2xl font-bold text-slate-900">{value}</div>
      {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
    </div>
  );
}

function ActivityRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <span>{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}

function ActionRow({ text, status }: { text: string; status: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <span>{text}</span>
      <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-amber-700">
        {status}
      </span>
    </div>
  );
}
