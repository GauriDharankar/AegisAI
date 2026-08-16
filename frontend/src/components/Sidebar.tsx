import {
  LayoutDashboard,
  ClipboardCheck,
  ShieldAlert,
  Clock3,
  Bell,
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
    name: "Review Queue",
    path: "/reviews",
    icon: ClipboardCheck,
  },
  {
    name: "Bias Alerts",
    path: "/alerts",
    icon: ShieldAlert,
  },
  {
    name: "Reminders",
    path: "/reminders",
    icon: Clock3,
  },
  {
    name: "Notifications",
    path: "/notifications",
    icon: Bell,
  },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-950 text-white">
      <div className="border-b border-slate-800 p-6">
        <h1 className="text-2xl font-bold">AegisAI</h1>
        <p className="mt-1 text-xs text-slate-400">
          Human Review Portal
        </p>
      </div>

      <nav className="space-y-2 p-4">
        {menuItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-4 py-3 transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:bg-slate-900 hover:text-white"
                }`
              }
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="absolute bottom-0 w-full border-t border-slate-800 p-4">
        <button className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-slate-400 hover:bg-slate-900 hover:text-white">
          <LogOut size={20} />
          Logout
        </button>
      </div>
    </aside>
  );
}