import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />

      <div className="ml-64">
        <Topbar />

        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}