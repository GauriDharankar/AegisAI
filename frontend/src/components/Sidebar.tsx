import {
  LayoutDashboard,
  ClipboardCheck,
  ShieldAlert,
  Settings,
  FileSearch,
  Bell,
  Clock3,
  LogOut,
} from "lucide-react";

import { NavLink } from "react-router-dom";

const menuItems = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Decision Queue",
    path: "/reviews",
    icon: ClipboardCheck,
  },
  {
    name: "Policies",
    path: "/policies",
    icon: FileSearch,
  },
  {
    name: "Fairness & Bias",
    path: "/fairness",
    icon: ShieldAlert,
  },
  {
    name: "Configuration",
    path: "/configuration",
    icon: Settings,
  },
  {
    name: "Audit Trail",
    path: "/audit",
    icon: FileSearch,
  },
  {
    name: "Notifications",
    path: "/notifications",
    icon: Bell,
  },
  {
    name: "Reminders",
    path: "/reminders",
    icon: Clock3,
  },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-slate-950 text-white">
      <div className="border-b border-slate-800 px-6 py-6">
        <h1 className="text-2xl font-bold">
          AegisAI
        </h1>

        <p className="mt-1 text-xs text-slate-400">
          AI Decision Governance
        </p>
      </div>

      <nav className="space-y-1 p-4">
        {menuItems.map((item) => {
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

      <div className="absolute bottom-0 w-full border-t border-slate-800 p-4">
        <button className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-slate-400 hover:bg-slate-900 hover:text-white">
          <LogOut size={19} />

          Logout
        </button>
      </div>
    </aside>
  );
}