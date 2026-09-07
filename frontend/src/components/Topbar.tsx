import { Bell, Search } from "lucide-react";

export default function Topbar() {
  return (
    <header className="flex h-20 items-center justify-between border-b bg-white px-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">
          AI Decision Governance
        </h2>
        <p className="text-sm text-slate-500">
          Explainable, fair and policy-compliant lending decisions
        </p>
      </div>

      <div className="flex items-center gap-5">
        <div className="hidden items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 md:flex">
          <Search size={18} className="text-slate-400" />
          <input
            placeholder="Search..."
            className="bg-transparent outline-none"
          />
        </div>

        <button className="relative">
          <Bell size={22} />
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-500" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-semibold text-white">
            HR
          </div>

          <div className="hidden md:block">
            <p className="text-sm font-semibold">Human Reviewer</p>
            <p className="text-xs text-slate-500">
              Compliance Team
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}