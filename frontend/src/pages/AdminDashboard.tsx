import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  ClipboardCheck,
  GitBranch,
  ShieldCheck,
  Users,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { getApplications, getAuditLogs, getOrganization, getTeams, getUsers, getWorkflow } from "../services/adminService";
import { getErrorMessage } from "../services/errorMessage";

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
  const [applications, setApplications] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const [orgResponse, usersResponse, teamsResponse, workflowResponse, applicationsResponse, auditResponse] =
        await Promise.all([
          getOrganization(token),
          getUsers(token),
          getTeams(token),
          getWorkflow(token),
          getApplications(token),
          getAuditLogs(token, { limit: 5 }),
        ]);
      setError(null);
      setOrganization(orgResponse.data);
      setUsers(usersResponse.data ?? []);
      setTeams(teamsResponse.data ?? []);
      setWorkflow(workflowResponse.data ?? null);
      setApplications(applicationsResponse.data ?? []);
      setRecentActivity(auditResponse.data ?? []);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Unable to load the organization overview."));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const retryDashboard = () => {
    setLoading(true);
    setError(null);
    void loadDashboard();
  };

  const activeWorkflowStages = (workflow?.stages ?? []) as WorkflowStageSummary[];
  const activeUsers = users.filter((candidate) => candidate.status === "active").length;
  const activeTeams = teams.filter((team) => team.status === "active").length;

  return (
    <div className="tenant-overview space-y-6 sm:space-y-7">
      <div className="tenant-overview-heading flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-700">Tenant administration</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Organization overview</h1>
          <p className="mt-2 text-sm text-slate-600">
            Review your organization’s people, teams and governance setup.
          </p>
        </div>
        <div className="flex max-w-full items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 sm:max-w-64">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-100">
            <Building2 size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-700">Organization</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">
              {organization?.organization_name ?? user?.tenant_name ?? "Current tenant"}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={retryDashboard} disabled={loading} className="rounded-md border border-red-300 px-3 py-1.5 font-medium disabled:opacity-60">
            {loading ? "Retrying…" : "Retry"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="tenant-state-card flex min-h-56 items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-sm font-medium text-slate-600 shadow-sm">
          <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-teal-700" />
          Loading organization overview…
        </div>
      ) : error && !organization ? (
        <div className="tenant-state-card rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-600">Dashboard data is unavailable until the tenant APIs respond successfully.</p>
          <button type="button" onClick={retryDashboard} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Retry loading</button>
        </div>
      ) : (
        <>
          <div className="tenant-kpi-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Link to="/admin/users"><StatCard title="Total users" value={users.length} icon={<Users size={18} />} /></Link>
            <Link to="/admin/teams"><StatCard title="Total teams" value={teams.length} description={`${activeTeams} active`} icon={<Building2 size={18} />} /></Link>
            <Link to="/admin/workflow"><StatCard title="Governance workflow" value={workflow?.status ?? "Not set"} icon={<GitBranch size={18} />} /></Link>
            <Link to="/admin/applications"><StatCard title="Applications" value={applications.length} icon={<ClipboardCheck size={18} />} /></Link>
            <Link to="/admin/users?status=active"><StatCard title="Active users" value={activeUsers} icon={<ShieldCheck size={18} />} /></Link>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)]">
            <div className="tenant-overview-panel rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Governance</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">Current workflow</h2>
                </div>
                <span className="tenant-status-badge rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  {workflow?.status ?? "inactive"}
                </span>
              </div>

              {activeWorkflowStages.length > 0 ? (
                <div className="space-y-3">
                  {activeWorkflowStages.map((stage, index) => (
                    <div key={`${stage.stage_type}-${index}`} className="tenant-workflow-stage flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:gap-4 sm:p-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#10213b] text-xs font-semibold text-white ring-4 ring-slate-50">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{stage.stage_type.replaceAll("_", " ")}</p>
                        <p className="text-sm text-slate-500">{stage.team_name ?? "Team not assigned"}</p>
                      </div>
                      <span className="tenant-stage-status rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                        {stage.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="tenant-empty-state rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                  No workflow stages configured yet.
                </div>
              )}
            </div>

            <div className="tenant-overview-panel rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 border-b border-slate-100 pb-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Workspace details</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">Organization profile</h2>
              </div>
              <dl className="space-y-2.5 text-sm">
                <div className="tenant-summary-row rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <dt className="text-slate-500">Organization</dt>
                  <dd className="mt-1 font-semibold text-slate-900">{organization?.organization_name ?? "Unassigned"}</dd>
                </div>
                <div className="tenant-summary-row rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <dt className="text-slate-500">Status</dt>
                  <dd className="mt-1">
                    <span className={`tenant-status-badge inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${organization?.status === "active" ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200" : "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200"}`}>
                      {organization?.status ?? "active"}
                    </span>
                  </dd>
                </div>
                <div className="tenant-summary-row rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <dt className="text-slate-500">Tenant ID</dt>
                  <dd className="mt-1 break-all font-mono text-xs font-medium text-slate-800">{organization?.id ?? user?.tenant_id ?? "—"}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="tenant-overview-panel rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4 border-b border-slate-100 pb-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Organization</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">Recent activity</h2>
              </div>
              {recentActivity.length ? (
                <div className="space-y-3 text-sm text-slate-600">
                  {recentActivity.slice(0, 5).map((entry) => (
                    <Link key={entry.id} to="/admin/audit" className="tenant-activity-row flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-3 hover:border-teal-200">
                      <span className="min-w-0 truncate">{entry.action.replaceAll("_", " ")}</span>
                      <span className="shrink-0 text-right text-xs text-slate-500">{new Date(entry.timestamp).toLocaleDateString()}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  No recorded activity yet. Configuration and user changes will be recorded here.
                </p>
              )}
            </div>

            <div className="tenant-overview-panel rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4 border-b border-slate-100 pb-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Administration</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">Pending actions</h2>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                <DashboardAction to="/admin/workflow" text="Configure workflow stage assignments" />
                <DashboardAction to="/admin/teams" text="Manage team membership" />
                <DashboardAction to="/admin/audit" text="Review persisted audit activity" />
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
    <div className="tenant-kpi-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-[11rem] text-xs font-semibold uppercase tracking-[0.08em] leading-5 text-slate-500">{title}</p>
        <div className="tenant-kpi-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100">{icon}</div>
      </div>
      <div className="mt-3 text-[1.7rem] font-semibold leading-none tracking-tight text-slate-900">{value}</div>
      {description && <p className="mt-2 text-xs font-medium text-slate-500">{description}</p>}
    </div>
  );
}

function DashboardAction({ to, text }: { to: string; text: string }) {
  return (
    <Link to={to} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 hover:border-teal-300 hover:bg-teal-50">
      <span>{text}</span>
      <span aria-hidden="true" className="text-teal-700">→</span>
    </Link>
  );
}
