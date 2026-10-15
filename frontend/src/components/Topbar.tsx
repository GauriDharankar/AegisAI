import { Bell, Menu, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = pathname.startsWith("/admin/teams")
      ? "/admin/teams"
      : pathname.startsWith("/admin/audit")
        ? "/admin/audit"
        : pathname.startsWith("/admin/applications")
          ? "/admin/applications"
          : "/admin/users";
    const query = search.trim();
    navigate(query ? `${target}?search=${encodeURIComponent(query)}` : target);
  };

  const pageTitle = [
    ["/admin/dashboard", "Organization overview"],
    ["/admin/organization", "Organization"],
    ["/admin/users", "Users"],
    ["/admin/teams", "Teams"],
    ["/admin/responsibilities", "Responsibilities"],
    ["/admin/workflow", "Workflow"],
    ["/admin/applications", "Applications"],
    ["/admin/audit", "Audit logs"],
    ["/admin/settings", "Settings"],
    ["/reviews", "Decision queue"],
    ["/alerts", "Bias alerts"],
    ["/policies", "Policies"],
    ["/fairness", "Fairness & bias"],
    ["/configuration", "Configuration"],
    ["/notifications", "Notifications"],
    ["/reminders", "Reminders"],
    ["/audit", "Audit trail"],
    ["/dashboard", "Overview"],
  ].find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1];

  const getRoleName = () => {
    const assignedRoles = user?.teams?.map((team) => team.role).filter(Boolean) ?? [];
    if (assignedRoles.length > 0) {
      return assignedRoles.join(" · ");
    }

    switch (user?.role) {
      case "OPERATIONS":
        return "Operations Team";

      case "RISK_OFFICER":
        return "Risk Officer";

      case "CREDIT_COMMITTEE":
        return "Credit Committee";

      case "MANAGER":
        return "Tenant Admin";

      default:
        return "Human Reviewer";
    }
  };

  const getInitials = () => {
    if (!user?.name) return "HR";

    return user.name
      .split(" ")
      .map((name) => name[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <header className="tenant-topbar sticky top-0 z-30 flex min-h-[76px] items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-4 shadow-[0_1px_3px_rgba(15,23,42,0.03)] backdrop-blur sm:px-6 lg:px-8">
      
      {/* Left Section */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label="Open navigation menu"
          onClick={onMenuClick}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 lg:hidden"
        >
          <Menu size={19} />
        </button>
        <div className="min-w-0">
        <h2 className="truncate text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
          {pageTitle ?? "Workspace"}
        </h2>
        <p className="mt-0.5 hidden truncate text-xs text-slate-500 sm:block">
          {user?.tenant_name ?? "Current Organization"}
          {user?.role ? ` · ${getRoleName()}` : ""}
        </p>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">

        {/* Search */}
        {user?.role === "MANAGER" && (
          <form
            onSubmit={submitSearch}
            role="search"
            className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition-colors focus-within:border-teal-600 focus-within:bg-white md:flex"
          >
            <Search size={18} className="text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search tenant users, teams, applications, or audit logs"
              placeholder="Search..."
              className="w-40 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </form>
        )}

        {/* Notifications */}
        <button
          type="button"
          aria-label="Notifications"
          onClick={() => navigate("/notifications")}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
          title="Notifications"
        >
          <Bell size={19} />
        </button>

        {/* User */}
        <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3 sm:gap-3 sm:pl-4">

          {/* Avatar */}
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e5f3f1] text-sm font-semibold text-[#176b67] ring-1 ring-[#cde5e1]">
            {getInitials()}
          </div>

          {/* User Details */}
          <div className="hidden max-w-40 md:block">
            <p className="truncate text-sm font-semibold text-slate-800">
              {user?.name || "Human Reviewer"}
            </p>

            <p className="truncate text-xs text-slate-500">
              {getRoleName()}
            </p>

            {user && (
              <p className="text-[10px] font-medium text-teal-700">
                Level {user.level}
              </p>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}