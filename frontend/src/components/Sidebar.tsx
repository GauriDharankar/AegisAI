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
  Building,
} from "lucide-react";

import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useToast } from "./ToastProvider";
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
    name: "Hunter Alerts",
    path: "/hunter-alerts",
    icon: ShieldAlert,
    roles: allRoles,
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

interface SidebarProps {
  isMobileMenuOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ isMobileMenuOpen, onMobileClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    showToast("Logout successful");
    navigate("/login");
  };

  const visibleMenuItems = menuItems.filter(
    (item) =>
      user &&
      item.roles.includes(user.role)
  );

  return (
    <>
      {isMobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={onMobileClose}
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] lg:hidden"
        />
      )}
      <aside
        className={`tenant-sidebar fixed inset-y-0 left-0 z-50 flex h-screen w-[min(84vw,272px)] flex-col bg-[#0b1426] text-white shadow-xl transition-transform duration-200 lg:z-40 lg:w-64 lg:shadow-none ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >

      {/* =========================
          LOGO
      ========================== */}

      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-300/20 bg-teal-300/10 text-teal-200">
            <ShieldCheck size={21} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[20px] font-semibold tracking-tight text-white">AegisAI</h1>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Governance workspace
            </p>
          </div>
        </div>
      </div>


      {/* =========================
          USER INFORMATION
      ========================== */}

      {user && (
        <div className="border-b border-white/10 px-4 py-4">
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
            Organization
          </p>
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-300/10 text-indigo-200">
              <Building size={17} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-white">
                {user.tenant_name ?? "Current Organization"}
              </p>
              <p className="mt-1 truncate text-[11px] text-slate-400">
                {user.role.replace("_", " ")}
              </p>
            </div>
          </div>
        </div>
      )}


      {/* =========================
          NAVIGATION
      ========================== */}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <nav aria-label="Tenant navigation" className="space-y-1.5 p-3">

          {visibleMenuItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onMobileClose}
                className={({ isActive }) =>
                  `tenant-sidebar-link relative flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300 ${
                    isActive
                      ? "border-teal-300/15 bg-teal-300/10 text-white shadow-sm"
                      : "border-transparent text-slate-400 hover:bg-white/[0.06] hover:text-white"
                  }`
                }
              >
                <Icon size={18} className="shrink-0 opacity-90" />

                <span>{item.name}</span>
              </NavLink>
            );
          })}

        </nav>
      </div>


      {/* =========================
          LOGOUT
      ========================== */}

      <div className="shrink-0 border-t border-white/10 p-3">

        <button
          onClick={handleLogout}
          className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
        >
          <LogOut size={19} />

          <span>Logout</span>
        </button>

      </div>

      </aside>
    </>
  );
}