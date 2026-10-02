import {
  LayoutDashboard,
  ClipboardCheck,
  ShieldAlert,
  Settings,
  FileSearch,
  Bell,
  Clock3,
  LogOut,
  Users,
  Building2,
  GitBranch,
  BriefcaseBusiness,
  FolderOpen,
  FileText,
  ShieldCheck,
} from "lucide-react";

import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import type { UserRole } from "../types/auth";

interface MenuItem {
  name: string;
  path: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const allRoles: UserRole[] = [
  "OPERATIONS",
  "RISK_OFFICER",
  "CREDIT_COMMITTEE",
  "MANAGER",
];

const menuItems: MenuItem[] = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    roles: allRoles,
  },
  {
    name: "Tenant Dashboard",
    path: "/admin/dashboard",
    icon: ShieldCheck,
    roles: ["MANAGER"],
  },
  {
    name: "Decision Queue",
    path: "/reviews",
    icon: ClipboardCheck,
    roles: allRoles,
  },
  {
    name: "Bias Alerts",
    path: "/alerts",
    icon: ShieldAlert,
    roles: ["RISK_OFFICER", "MANAGER"],
  },
  {
    name: "Policies",
    path: "/policies",
    icon: FileSearch,
    roles: ["RISK_OFFICER", "MANAGER"],
  },
  {
    name: "Fairness & Bias",
    path: "/fairness",
    icon: ShieldAlert,
    roles: ["RISK_OFFICER", "MANAGER"],
  },
  {
    name: "Audit Trail",
    path: "/audit",
    icon: FileSearch,
    roles: ["CREDIT_COMMITTEE", "MANAGER"],
  },
  {
    name: "Configuration",
    path: "/configuration",
    icon: Settings,
    roles: ["MANAGER"],
  },
  {
    name: "Organization",
    path: "/admin/organization",
    icon: Building2,
    roles: ["MANAGER"],
  },
  {
    name: "Users",
    path: "/admin/users",
    icon: Users,
    roles: ["MANAGER"],
  },
  {
    name: "Teams",
    path: "/admin/teams",
    icon: ClipboardCheck,
    roles: ["MANAGER"],
  },
  {
    name: "Responsibilities",
    path: "/admin/responsibilities",
    icon: BriefcaseBusiness,
    roles: ["MANAGER"],
  },
  {
    name: "Workflow",
    path: "/admin/workflow",
    icon: GitBranch,
    roles: ["MANAGER"],
  },
  {
    name: "Applications",
    path: "/admin/applications",
    icon: FolderOpen,
    roles: ["MANAGER"],
  },
  {
    name: "Audit Logs",
    path: "/admin/audit",
    icon: FileText,
    roles: ["MANAGER"],
  },
  {
    name: "Settings",
    path: "/admin/settings",
    icon: Settings,
    roles: ["MANAGER"],
  },
  {
    name: "Notifications",
    path: "/notifications",
    icon: Bell,
    roles: allRoles,
  },
  {
    name: "Reminders",
    path: "/reminders",
    icon: Clock3,
    roles: allRoles,
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const visibleMenuItems = menuItems.filter(
    (item) =>
      user &&
      item.roles.includes(user.role)
  );

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-slate-950 text-white">

      {/* =========================
          LOGO
      ========================== */}

      <div className="border-b border-slate-800 px-6 py-6">
        <h1 className="text-2xl font-bold">
          AegisAI
        </h1>

        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
          Multi Tenant AI Governance Engine
        </p>
      </div>


      {/* =========================
          USER INFORMATION
      ========================== */}

      {user && (
        <div className="border-b border-slate-800 px-5 py-4">
          <p className="truncate text-sm font-medium text-white">
            {user.tenant_name ?? "Current Organization"}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {user.name}
          </p>

          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">
            {user.role.replace("_", " ")}
          </p>
        </div>
      )}


      {/* =========================
          NAVIGATION
      ========================== */}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <nav className="space-y-1 p-4">

          {visibleMenuItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:bg-slate-900 hover:text-white"
                  }`
                }
              >
                <Icon size={19} />

                <span>{item.name}</span>
              </NavLink>
            );
          })}

        </nav>
      </div>


      {/* =========================
          LOGOUT
      ========================== */}

      <div className="shrink-0 border-t border-slate-800 p-4">

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-slate-400 transition hover:bg-slate-900 hover:text-white"
        >
          <LogOut size={19} />

          <span>Logout</span>
        </button>

      </div>

    </aside>
  );
}