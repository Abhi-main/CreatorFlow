import { Outlet } from "react-router-dom";
import { useState } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

export default function ProtectedLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="page-shell px-3 pb-24 pt-4 md:px-4 md:pb-6">
      <div className="mx-auto flex max-w-[1600px] gap-4">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((current) => !current)} />
        <div className="min-w-0 flex-1">
          <Navbar />
          <Outlet />
        </div>
      </div>
    </div>
  );
}
