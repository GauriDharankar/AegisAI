import { Bell, Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Topbar() {
  const { user } = useAuth();

  const getRoleName = () => {
    switch (user?.role) {
      case "OPERATIONS":
        return "Operations Team";

      case "RISK_OFFICER":
        return "Risk Officer";

      case "CREDIT_COMMITTEE":
        return "Credit Committee";

      case "MANAGER":
        return "Manager";

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
    <header className="flex h-20 items-center justify-between border-b bg-white px-8">
      
      {/* Left Section */}
      <div>
        <h2 className="text-xl font-semibold text-slate-800">
          AI Decision Governance
        </h2>

        <p className="text-sm text-slate-500">
          Explainable, fair and policy-compliant lending decisions
        </p>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-5">

        {/* Search */}
        <div className="hidden items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 md:flex">
          <Search
            size={18}
            className="text-slate-400"
          />

          <input
            type="text"
            placeholder="Search..."
            className="w-40 bg-transparent text-sm outline-none"
          />
        </div>

        {/* Notifications */}
        <button
          className="relative rounded-lg p-2 hover:bg-slate-100"
          title="Notifications"
        >
          <Bell size={22} />

          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-red-500" />
        </button>

        {/* User */}
        <div className="flex items-center gap-3">

          {/* Avatar */}
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-semibold text-white">
            {getInitials()}
          </div>

          {/* User Details */}
          <div className="hidden md:block">
            <p className="text-sm font-semibold text-slate-800">
              {user?.name || "Human Reviewer"}
            </p>

            <p className="text-xs text-slate-500">
              {getRoleName()}
            </p>

            {user && (
              <p className="text-[10px] text-blue-600">
                Level {user.level}
              </p>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}