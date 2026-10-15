import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import "../styles/tenant-dashboard.css";

export default function DashboardLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 lg:bg-[#f4f7fa]">
      <Sidebar
        isMobileMenuOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />

      <div className="min-w-0 lg:ml-64">
        <Topbar onMenuClick={() => setIsMobileMenuOpen(true)} />

        <main className="tenant-workspace min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto min-w-0 max-w-[1440px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}