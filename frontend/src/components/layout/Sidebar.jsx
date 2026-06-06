import {
  BarChart2,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  FileText,
  Hash,
  LayoutDashboard,
  Megaphone,
  Settings,
  ShieldCheck,
  UserCircle2
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { teamsApi } from "../../api/services";
import OnlineUsers from "../OnlineUsers";
import { useAuth } from "../../context/AuthContext";

const navItems = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Calendar", to: "/calendar", icon: CalendarDays },
  { label: "Schedule Post", to: "/schedule", icon: CalendarPlus },
  { label: "Post History", to: "/posts", icon: FileText },
  { label: "Analytics", to: "/analytics", icon: BarChart2 },
  { label: "Campaigns", to: "/campaigns", icon: Megaphone },
  { label: "Hashtags", to: "/hashtags", icon: Hash },
  { label: "Admin Panel", to: "/admin", icon: ShieldCheck, adminOnly: true },
  { label: "Settings", to: "/settings", icon: Settings }
];

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth();
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    if (!user?.team_id) return;
    teamsApi
      .listMembers(user.team_id)
      .then((payload) => setTeamMembers(payload?.items || payload?.data || (Array.isArray(payload) ? payload : [])))
      .catch(() => setTeamMembers([]));
  }, [user?.team_id]);

  const visibleItems = navItems.filter((item) => !item.adminOnly || ["admin", "superadmin"].includes(user?.role_name));

  return (
    <>
      <aside className={`hidden shrink-0 md:flex md:flex-col ${collapsed ? "w-16" : "w-64"} transition-all duration-200`}>
        <div className="app-surface sticky top-4 flex h-[calc(100vh-2rem)] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-5">
            {!collapsed ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-orange">Smart Social</p>
                <p className="mt-1 text-sm text-slate-500">CreatorFlow</p>
              </div>
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-orange-50 text-brand-orange">
                <LayoutDashboard className="h-5 w-5" />
              </div>
            )}

            <button type="button" onClick={onToggle} className="rounded-xl border border-slate-200 p-2 text-slate-500">
              <ChevronLeft className={`h-4 w-4 transition ${collapsed ? "rotate-180" : ""}`} />
            </button>
          </div>

          <nav className="flex-1 space-y-2 px-3 py-4">
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition",
                    collapsed ? "justify-center" : "",
                    isActive
                      ? "border border-orange-200 bg-orange-100 text-slate-950 shadow-sm"
                      : "text-slate-600 hover:bg-orange-50 hover:text-brand-orange"
                  ].join(" ")
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed ? <span>{item.label}</span> : null}
              </NavLink>
            ))}
          </nav>

          <OnlineUsers teamMembers={teamMembers} collapsed={collapsed} />

          <div className="border-t border-slate-100 p-3">
            <div className={`mb-3 flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3 ${collapsed ? "justify-center" : ""}`}>
              <div className="grid h-10 w-10 place-items-center rounded-full bg-violet-100 text-brand-purple">
                <UserCircle2 className="h-5 w-5" />
              </div>
              {!collapsed ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{user?.full_name}</p>
                  <p className="truncate text-xs uppercase tracking-[0.2em] text-slate-400">{user?.role_name}</p>
                </div>
              ) : null}
            </div>

            <button type="button" onClick={logout} className="app-button-secondary w-full">
              {collapsed ? "Out" : "Logout"}
            </button>
          </div>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 py-2 shadow-[0_-8px_24px_rgba(31,35,64,0.08)] backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-1">
          {visibleItems.slice(0, 5).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold ${
                  isActive ? "border border-orange-200 bg-orange-100 text-slate-950" : "text-slate-500"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
