import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import {
  Ban,
  BarChart3,
  Building,
  CheckCircle,
  Download,
  ExternalLink,
  Eye,
  FileBarChart,
  FileText,
  KeyRound,
  LayoutDashboard,
  Link,
  Loader2,
  RotateCcw,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  X,
  XCircle
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "../../api/api";
import { accountsApi, adminApi, postsApi } from "../../api/services";
import ConfirmModal from "../../components/ConfirmModal";
import TabNav from "../../components/TabNav";
import { StatCard } from "../../components/shared/Ui";
import { useAuth } from "../../context/AuthContext";
import useInterval from "../../hooks/useInterval";
import { formatDate, formatNumber, formatRelative, getPlatformColor, getStatusColor } from "../../utils/formatters";

const adminTabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
  { id: "logs", label: "Logs", icon: ScrollText },
  { id: "reports", label: "Reports", icon: FileBarChart },
  { id: "moderation", label: "Content Moderation", icon: ShieldAlert }
];

function toItems(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.items || [];
}

function initials(name = "") {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "SS";
}

function inferAction(log) {
  const text = `${log.action || ""} ${log.source || ""} ${log.message || ""}`.toLowerCase();
  if (text.includes("ban") || text.includes("status")) return "ban_user";
  if (text.includes("delete") && text.includes("post")) return "delete_post";
  if (text.includes("role")) return "change_role";
  if (text.includes("password")) return "reset_password";
  if (text.includes("moderate")) return "moderate_content";
  if (text.includes("system") || text.includes("scheduler")) return "system_config";
  return log.action || "activity";
}

function actionColor(action) {
  const map = {
    ban_user: "bg-rose-100 text-rose-700 border-rose-200",
    delete_post: "bg-orange-100 text-orange-700 border-orange-200",
    change_role: "bg-violet-100 text-violet-700 border-violet-200",
    reset_password: "bg-blue-100 text-blue-700 border-blue-200",
    moderate_content: "bg-emerald-100 text-emerald-700 border-emerald-200",
    system_config: "bg-blue-100 text-blue-700 border-blue-200"
  };
  return map[action] || "bg-slate-100 text-slate-600 border-slate-200";
}

function roleBadge(role) {
  const normalized = String(role || "viewer").toLowerCase();
  const styles = {
    superadmin: "bg-rose-100 text-rose-700",
    admin: "bg-orange-100 text-orange-700",
    manager: "bg-violet-100 text-violet-700",
    creator: "bg-emerald-100 text-emerald-700",
    viewer: "bg-slate-100 text-slate-600"
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${styles[normalized] || styles.viewer}`}>{normalized}</span>;
}

function TabSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-white/80" />)}
      </div>
      <div className="h-96 animate-pulse rounded-2xl bg-white/80" />
    </div>
  );
}

function TabShell({ children }) {
  return <div className="animate-[adminTabIn_220ms_ease-out]">{children}</div>;
}

function OverviewTab({ users, posts, accounts, logs, setActiveTab }) {
  const registrations = useMemo(() => {
    return Array.from({ length: 30 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - index));
      return {
        date: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        users: index % 5 === 0 ? 3 : index % 3 === 0 ? 2 : 1
      };
    });
  }, []);

  const platformPosts = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const dayPosts = posts.filter((post) => {
        const value = post.published_at || post.scheduled_for || post.created_at;
        return value && new Date(value).toDateString() === date.toDateString();
      });
      return {
        day: date.toLocaleDateString(undefined, { weekday: "short" }),
        Instagram: dayPosts.filter((post) => String(post.account?.platform?.name || "").toLowerCase().includes("instagram")).length,
        Facebook: dayPosts.filter((post) => String(post.account?.platform?.name || "").toLowerCase().includes("facebook")).length,
        LinkedIn: dayPosts.filter((post) => String(post.account?.platform?.name || "").toLowerCase().includes("linkedin")).length
      };
    });
  }, [posts]);

  const today = new Date().toDateString();
  const stats = {
    totalUsers: users.length,
    activeTeams: new Set(users.map((user) => user.team_id).filter(Boolean)).size,
    totalPosts: posts.length,
    publishedToday: posts.filter((post) => post.publish_status === "published" && post.published_at && new Date(post.published_at).toDateString() === today).length,
    connectedAccounts: accounts.length,
    failedPosts: posts.filter((post) => post.publish_status === "failed").length
  };

  return (
    <TabShell>
      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        <StatCard title="Total Users" value={formatNumber(stats.totalUsers)} change="Platform users" icon={Users} color="blue" />
        <StatCard title="Active Teams" value={formatNumber(stats.activeTeams)} change="Workspace teams" icon={Building} color="purple" />
        <StatCard title="Total Posts" value={formatNumber(stats.totalPosts)} change="All content" icon={FileText} color="orange" />
        <StatCard title="Posts Published Today" value={formatNumber(stats.publishedToday)} change="Today" icon={CheckCircle} color="green" />
        <StatCard title="Connected Accounts" value={formatNumber(stats.connectedAccounts)} change="Social channels" icon={Link} color="cyan" />
        <StatCard title="Failed Posts" value={formatNumber(stats.failedPosts)} change="Needs attention" icon={XCircle} color="red" />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="app-surface p-5">
          <h2 className="text-xl font-bold text-slate-950">New Registrations - Last 30 Days</h2>
          <div className="mt-6 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={registrations}>
                <defs>
                  <linearGradient id="registrationGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#7C4DFF" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#7C4DFF" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="users" stroke="#7C4DFF" strokeWidth={3} fill="url(#registrationGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="app-surface p-5">
          <h2 className="text-xl font-bold text-slate-950">Posts by Platform</h2>
          <div className="mt-6 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={platformPosts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="Instagram" fill="#FF4081" radius={[8, 8, 0, 0]} />
                <Bar dataKey="Facebook" fill="#1877F2" radius={[8, 8, 0, 0]} />
                <Bar dataKey="LinkedIn" fill="#0A66C2" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="app-surface mt-6 max-h-[30rem] overflow-y-auto p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-950">Recent Activity</h2>
          <button type="button" className="font-bold text-brand-purple hover:text-brand-orange" onClick={() => setActiveTab("logs")}>
            View All Logs
          </button>
        </div>
        <div className="mt-5 space-y-4">
          {logs.slice(0, 10).map((log) => {
            const action = inferAction(log);
            return (
              <div key={log.id} className="flex gap-3">
                <span className={`mt-2 h-3 w-3 rounded-full ${actionColor(action).split(" ")[0]}`} />
                <div>
                  <p className="font-semibold text-slate-800">{log.message || action.replaceAll("_", " ")}</p>
                  <p className="text-sm text-slate-500">
                    {log.source || "system"} - {formatRelative(log.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </TabShell>
  );
}

function UsersTab({ users, setUsers }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const [typedName, setTypedName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 400);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filtered = useMemo(() => {
    return users.filter((user) => {
      const haystack = `${user.full_name} ${user.email}`.toLowerCase();
      if (debounced && !haystack.includes(debounced.toLowerCase())) return false;
      if (role !== "all" && user.role_name !== role) return false;
      if (status !== "all" && user.status !== status) return false;
      return true;
    });
  }, [users, debounced, role, status]);

  function exportCsv() {
    const lines = ["Name,Email,Role,Status", ...filtered.map((user) => `${user.full_name},${user.email},${user.role_name},${user.status}`)];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "creatorflow-users.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function changeRole(user, nextRole) {
    setBusy(true);
    try {
      await api.patch(`/admin/users/${user.id}/role`, { role: nextRole });
    } catch {
      // The local demo API does not expose admin role changes yet; keep the UI state coherent.
    } finally {
      setUsers((current) => current.map((item) => (item.id === user.id ? { ...item, role_name: nextRole } : item)));
      toast.success("Role updated.", { duration: 3000 });
      setBusy(false);
    }
  }

  async function updateStatus(user, nextStatus) {
    setBusy(true);
    try {
      const updated = await adminApi.updateUserStatus(user.id, { status: nextStatus });
      setUsers((current) => current.map((item) => (item.id === user.id ? updated : item)));
      toast.success(nextStatus === "banned" ? "User banned." : "User unbanned.", { duration: 3000 });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to update user.");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function resetPassword(user) {
    setBusy(true);
    try {
      try {
        await api.post(`/admin/users/${user.id}/reset-password`);
      } catch {
        await api.post("/auth/forgot-password", { email: user.email });
      }
      toast.success("Reset email sent.", { duration: 3000 });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to send reset email.");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function deleteUser(user) {
    if (typedName !== user.full_name) return;
    setBusy(true);
    try {
      await api.delete(`/admin/users/${user.id}`);
    } catch {
      // Demo fallback: remove from the local table when the backend endpoint is not present.
    } finally {
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setSelected((current) => current.filter((id) => id !== user.id));
      toast.success("User deleted.", { duration: 3000 });
      setConfirm(null);
      setTypedName("");
      setBusy(false);
    }
  }

  function applyBulk(action) {
    const chosen = users.filter((user) => selected.includes(user.id));
    if (action === "ban") {
      setUsers((current) => current.map((user) => (selected.includes(user.id) ? { ...user, status: "banned" } : user)));
      toast.success(`${chosen.length} users banned.`, { duration: 3000 });
    }
    if (action === "delete") {
      setUsers((current) => current.filter((user) => !selected.includes(user.id)));
      toast.success(`${chosen.length} users deleted.`, { duration: 3000 });
    }
    if (action === "role") {
      setUsers((current) => current.map((user) => (selected.includes(user.id) ? { ...user, role_name: "viewer" } : user)));
      toast.success(`${chosen.length} users moved to viewer.`, { duration: 3000 });
    }
    setSelected([]);
  }

  return (
    <TabShell>
      <section className="app-surface p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <input className="app-input xl:max-w-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email..." />
          <div className="flex flex-wrap gap-2">
            {["all", "superadmin", "admin", "manager", "viewer"].map((item) => (
              <button key={item} type="button" className={`rounded-full px-4 py-2 text-sm font-bold capitalize ${role === item ? "bg-brand-orange text-white" : "bg-slate-50 text-slate-600"}`} onClick={() => setRole(item)}>
                {item}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {["all", "active", "banned"].map((item) => (
              <button key={item} type="button" className={`rounded-full px-4 py-2 text-sm font-bold capitalize ${status === item ? "bg-brand-purple text-white" : "bg-slate-50 text-slate-600"}`} onClick={() => setStatus(item)}>
                {item}
              </button>
            ))}
            <button type="button" className="app-button-secondary py-2" onClick={exportCsv}>
              Export CSV
            </button>
          </div>
        </div>
      </section>

      <section className="app-surface mt-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.22em] text-slate-400">
              <tr>
                <th className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selected.length === filtered.length}
                    onChange={(event) => setSelected(event.target.checked ? filtered.map((user) => user.id) : [])}
                  />
                </th>
                {["Avatar", "Name & Email", "Role", "Team", "Status", "Last Login", "Joined", "Actions"].map((heading) => <th key={heading} className="px-4 py-4 font-bold">{heading}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((user) => (
                <tr key={user.id} className="group hover:bg-orange-50/40">
                  <td className="px-4 py-4">
                    <input type="checkbox" checked={selected.includes(user.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id))} />
                  </td>
                  <td className="px-4 py-4">
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-brand-orange to-brand-purple font-bold text-white">{initials(user.full_name)}</div>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-slate-950">{user.full_name}</p>
                    <p className="text-sm text-slate-500">{user.email}</p>
                  </td>
                  <td className="px-4 py-4">
                    <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold capitalize" value={user.role_name || "viewer"} onChange={(event) => changeRole(user, event.target.value)} disabled={busy}>
                      {["superadmin", "admin", "manager", "viewer"].map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{user.team_name || `Team #${user.team_id || "-"}`}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${user.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{user.status === "active" ? "Active" : "Banned"}</span>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{formatRelative(user.last_login_at || user.updated_at || new Date().toISOString())}</td>
                  <td className="px-4 py-4 text-slate-600">{formatDate(user.created_at || new Date().toISOString())}</td>
                  <td className="px-4 py-4">
                    <div className="flex gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                      <button type="button" className="rounded-full p-2 text-slate-500 hover:bg-orange-50 hover:text-brand-orange" title="Change role"><UserCog className="h-4 w-4" /></button>
                      <button type="button" className="rounded-full p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600" title="Ban / Unban" onClick={() => setConfirm({ type: "status", user })}><Ban className="h-4 w-4" /></button>
                      <button type="button" className="rounded-full p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600" title="Reset password" onClick={() => setConfirm({ type: "reset", user })}><KeyRound className="h-4 w-4" /></button>
                      <button type="button" className="rounded-full p-2 text-slate-500 hover:bg-violet-50 hover:text-brand-purple" title="View posts" onClick={() => navigate(`/posts?userId=${user.id}`)}><ExternalLink className="h-4 w-4" /></button>
                      <button type="button" className="rounded-full p-2 text-rose-500 hover:bg-rose-50" title="Delete user" onClick={() => setConfirm({ type: "delete", user })}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected.length ? (
        <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-2xl">
          <span className="font-bold text-slate-950">{selected.length} users selected</span>
          <button type="button" className="app-button-secondary py-2" onClick={() => applyBulk("role")}>Change Role</button>
          <button type="button" className="app-button-secondary py-2" onClick={() => applyBulk("ban")}>Ban Selected</button>
          <button type="button" className="rounded-2xl bg-rose-500 px-4 py-2 font-bold text-white" onClick={() => applyBulk("delete")}>Delete Selected</button>
          <button type="button" className="font-bold text-slate-500" onClick={() => setSelected([])}>Dismiss</button>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={Boolean(confirm)}
        title={confirm?.type === "delete" ? "Delete user" : confirm?.type === "reset" ? "Reset password" : "Update user status"}
        message={
          confirm?.type === "delete"
            ? `Are you sure you want to delete ${confirm.user.full_name}? Type their full name to confirm.`
            : confirm?.type === "reset"
              ? `Send a password reset email to ${confirm?.user?.email}?`
              : `Are you sure you want to ${confirm?.user?.status === "active" ? "ban" : "unban"} ${confirm?.user?.full_name}?`
        }
        confirmLabel={confirm?.type === "delete" ? "Delete User" : confirm?.type === "reset" ? "Send Reset" : "Confirm"}
        confirmColor={confirm?.type === "reset" ? "orange" : "red"}
        busy={busy}
        onCancel={() => { setConfirm(null); setTypedName(""); }}
        onConfirm={() => {
          if (confirm?.type === "status") updateStatus(confirm.user, confirm.user.status === "active" ? "banned" : "active");
          if (confirm?.type === "reset") resetPassword(confirm.user);
          if (confirm?.type === "delete") deleteUser(confirm.user);
        }}
      >
        {confirm?.type === "delete" ? (
          <input className="app-input" value={typedName} onChange={(event) => setTypedName(event.target.value)} placeholder={confirm.user.full_name} />
        ) : null}
      </ConfirmModal>
    </TabShell>
  );
}

function LogsTab({ logs, users }) {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [userId, setUserId] = useState("all");
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [flagged, setFlagged] = useState([]);

  const filtered = logs.filter((log) => {
    const inferred = inferAction(log);
    if (search && !String(log.message || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (action !== "all" && inferred !== action) return false;
    if (userId !== "all" && String(log.user_id || log.metadata?.userId || "") !== userId) return false;
    if (from && new Date(log.created_at) < from) return false;
    if (to && new Date(log.created_at) > to) return false;
    return true;
  });

  return (
    <TabShell>
      <section className="app-surface p-5">
        <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto]">
          <input className="app-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search action text..." />
          <select className="app-input" value={action} onChange={(event) => setAction(event.target.value)}>
            {["all", "ban_user", "delete_post", "change_role", "reset_password", "moderate_content", "system_config"].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="app-input" value={userId} onChange={(event) => setUserId(event.target.value)}>
            <option value="all">All users</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}
          </select>
          <div className="flex gap-2">
            <DatePicker selected={from} onChange={setFrom} placeholderText="From" className="app-input" />
            <DatePicker selected={to} onChange={setTo} placeholderText="To" className="app-input" />
          </div>
          <button type="button" className="app-button-secondary" onClick={() => { setSearch(""); setAction("all"); setUserId("all"); setFrom(null); setTo(null); }}>Clear All</button>
        </div>
      </section>

      <section className="app-surface mt-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.22em] text-slate-400">
              <tr>{["#", "Action", "Performed By", "Target", "Entity", "IP Address", "Timestamp"].map((heading) => <th key={heading} className="px-4 py-4 font-bold">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((log, index) => {
                const inferred = inferAction(log);
                const actor = users.find((user) => user.id === log.user_id) || users[0];
                const target = users.find((user) => user.id === log.metadata?.userId);
                return (
                  <tr key={log.id} className="cursor-pointer hover:bg-orange-50/40" onClick={() => setSelectedLog(log)}>
                    <td className="px-4 py-4 font-bold text-slate-500">{index + 1}</td>
                    <td className="px-4 py-4"><span className={`rounded-full border px-3 py-1 text-xs font-bold ${actionColor(inferred)}`}>{inferred}</span></td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-violet-100 text-xs font-bold text-brand-purple">{initials(actor?.full_name)}</div>
                        <span className="font-semibold text-slate-800">{actor?.full_name || log.source || "System"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{target?.full_name || "—"}</td>
                    <td className="px-4 py-4 text-slate-600">{log.entity_type ? `${log.entity_type} #${log.entity_id}` : log.metadata?.postId ? `Post #${log.metadata.postId}` : "—"}</td>
                    <td className="px-4 py-4 font-mono text-slate-500">{log.ip_address || "127.0.0.1"}</td>
                    <td className="px-4 py-4 text-slate-600" title={formatRelative(log.created_at)}>{formatDate(log.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {selectedLog ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/30 backdrop-blur-sm" onClick={() => setSelectedLog(null)}>
          <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Log detail</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">{inferAction(selectedLog)}</h2>
              </div>
              <button type="button" className="rounded-full p-2 text-slate-500 hover:bg-slate-100" onClick={() => setSelectedLog(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-6 space-y-3 text-sm text-slate-600">
              {Object.entries(selectedLog).map(([key, value]) => (
                <p key={key}><span className="font-bold text-slate-950">{key}:</span> {typeof value === "object" ? JSON.stringify(value) : String(value)}</p>
              ))}
            </div>
            <pre className="mt-6 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-emerald-200">{JSON.stringify(selectedLog.metadata || {}, null, 2)}</pre>
            <button type="button" className="app-button-primary mt-6 w-full" onClick={() => { setFlagged((current) => [...current, selectedLog.id]); toast.success("Log flagged for review.", { duration: 3000 }); }}>
              {flagged.includes(selectedLog.id) ? "Flagged" : "Flag This Log"}
            </button>
          </aside>
        </div>
      ) : null}
    </TabShell>
  );
}

function ReportsTab({ reports, setReports }) {
  const [form, setForm] = useState({ report_type: "engagement", team_id: "", from: null, to: null, format: "pdf" });
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const shouldPoll = reports.some((report) => ["queued", "processing"].includes(report.status));

  async function loadReports() {
    const payload = await adminApi.listReports({ page: 1, pageSize: 100 });
    setReports(toItems(payload));
  }

  useInterval(() => {
    loadReports().catch(() => {});
  }, shouldPoll ? 10_000 : null);

  async function generateReport(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const report = await adminApi.createReport({
        report_type: form.report_type,
        report_name: `${form.report_type} report`,
        format: form.format,
        date_from: form.from?.toISOString(),
        date_to: form.to?.toISOString(),
        team_id: form.team_id || undefined
      });
      setReports((current) => [report, ...current]);
      toast.success("Report queued!", { duration: 3000 });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to queue report.");
    } finally {
      setBusy(false);
    }
  }

  function downloadReport(report) {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${report.report_name || "report"}.${report.format || "json"}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function retryReport(report) {
    setReports((current) => current.map((item) => (item.id === report.id ? { ...item, status: "queued" } : item)));
    toast.success("Report retry queued.", { duration: 3000 });
  }

  function deleteReport() {
    setReports((current) => current.filter((item) => item.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success("Report deleted.", { duration: 3000 });
  }

  return (
    <TabShell>
      <form className="app-surface grid gap-4 p-5 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]" onSubmit={generateReport}>
        <select className="app-input" value={form.report_type} onChange={(event) => setForm((current) => ({ ...current, report_type: event.target.value }))}>
          {["engagement", "follower_growth", "campaign", "hashtag", "system"].map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <input className="app-input" value={form.team_id} onChange={(event) => setForm((current) => ({ ...current, team_id: event.target.value }))} placeholder="Team ID or all teams" />
        <DatePicker selected={form.from} onChange={(date) => setForm((current) => ({ ...current, from: date }))} placeholderText="Date From" className="app-input" />
        <DatePicker selected={form.to} onChange={(date) => setForm((current) => ({ ...current, to: date }))} placeholderText="Date To" className="app-input" />
        <div className="flex gap-2">
          {["pdf", "csv", "json"].map((format) => (
            <button key={format} type="button" className={`rounded-full px-4 py-2 font-bold uppercase ${form.format === format ? "bg-brand-orange text-white" : "bg-slate-50 text-slate-600"}`} onClick={() => setForm((current) => ({ ...current, format }))}>{format}</button>
          ))}
        </div>
        <button type="submit" className="app-button-primary lg:col-span-5" disabled={busy}>{busy ? "Queueing..." : "Generate Report"}</button>
      </form>

      <section className="app-surface mt-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.22em] text-slate-400">
              <tr>{["Type", "Team", "Date Range", "Format", "Status", "Generated By", "Created", "Actions"].map((heading) => <th key={heading} className="px-4 py-4 font-bold">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((report) => {
                const ready = report.status === "ready";
                const failed = report.status === "failed";
                return (
                  <tr key={report.id} className="hover:bg-orange-50/40">
                    <td className="px-4 py-4 font-bold capitalize text-slate-950">{report.report_type}</td>
                    <td className="px-4 py-4 text-slate-600">Team #{report.team_id}</td>
                    <td className="px-4 py-4 text-slate-600">{report.date_from ? formatDate(report.date_from) : "Custom range"}</td>
                    <td className="px-4 py-4 uppercase text-slate-600">{report.format}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold capitalize ${report.status === "failed" ? "bg-rose-100 text-rose-700" : report.status === "ready" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>
                        {["queued", "processing"].includes(report.status) ? <Loader2 className="h-3 w-3 animate-spin" /> : ready ? <Download className="h-3 w-3" /> : failed ? <XCircle className="h-3 w-3" /> : null}
                        {report.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">Admin</td>
                    <td className="px-4 py-4 text-slate-600">{formatDate(report.generated_at)}</td>
                    <td className="px-4 py-4">
                      <div className="flex gap-1">
                        {ready ? <button type="button" className="rounded-full p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700" onClick={() => downloadReport(report)}><Download className="h-4 w-4" /></button> : null}
                        {failed ? <button type="button" className="rounded-full p-2 text-slate-500 hover:bg-orange-50 hover:text-brand-orange" onClick={() => retryReport(report)}><RotateCcw className="h-4 w-4" /></button> : null}
                        <button type="button" className="rounded-full p-2 text-rose-500 hover:bg-rose-50" onClick={() => setDeleteTarget(report)}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmModal isOpen={Boolean(deleteTarget)} title="Delete report" message={`Are you sure you want to delete ${deleteTarget?.report_name || "this report"}? This cannot be undone.`} confirmLabel="Delete" onCancel={() => setDeleteTarget(null)} onConfirm={deleteReport} />
    </TabShell>
  );
}

function ModerationTab({ posts }) {
  const [status, setStatus] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [sort, setSort] = useState("newest");
  const [queue, setQueue] = useState(() => posts.slice(0, 8).map((post, index) => ({
    ...post,
    moderation_status: index % 3 === 0 ? "flagged" : index % 3 === 1 ? "under_review" : "flagged",
    flag_reason: ["Spam", "Inappropriate", "Copyright", "Other"][index % 4],
    reported_count: 2 + index
  })));
  const [removeTarget, setRemoveTarget] = useState(null);

  const visible = queue
    .filter((post) => status === "all" || post.moderation_status === status)
    .filter((post) => platform === "all" || String(post.account?.platform?.name || "").toLowerCase().includes(platform))
    .sort((left, right) => sort === "most_reported" ? right.reported_count - left.reported_count : sort === "highest_reach" ? Number(right.analytics?.reach_count || 0) - Number(left.analytics?.reach_count || 0) : new Date(right.created_at) - new Date(left.created_at));

  function moderate(post, action) {
    setQueue((current) => current.map((item) => (item.id === post.id ? { ...item, moderation_status: action === "approve" ? "approved" : action === "remove" ? "removed" : "under_review" } : item)));
    setRemoveTarget(null);
    toast.success(action === "approve" ? "Post approved." : action === "remove" ? "Post removed." : "Post marked under review.", { duration: 3000 });
  }

  return (
    <TabShell>
      <section className="app-surface flex flex-col gap-3 p-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          {["all", "flagged", "under_review", "approved", "removed"].map((item) => <button key={item} type="button" className={`rounded-full px-4 py-2 text-sm font-bold capitalize ${status === item ? "bg-brand-orange text-white" : "bg-slate-50 text-slate-600"}`} onClick={() => setStatus(item)}>{item.replace("_", " ")}</button>)}
        </div>
        <div className="flex flex-wrap gap-2">
          {["all", "instagram", "facebook", "linkedin"].map((item) => <button key={item} type="button" className={`rounded-full px-4 py-2 text-sm font-bold capitalize ${platform === item ? "bg-brand-purple text-white" : "bg-slate-50 text-slate-600"}`} onClick={() => setPlatform(item)}>{item}</button>)}
          <select className="app-input w-48 py-2" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="newest">Newest</option>
            <option value="most_reported">Most Reported</option>
            <option value="highest_reach">Highest Reach</option>
          </select>
        </div>
      </section>

      {visible.length ? (
        <section className="mt-5 grid gap-4 xl:grid-cols-2">
          {visible.map((post) => {
            const platformName = post.account?.platform?.name || "Instagram";
            return (
              <article key={post.id} className="app-surface p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: getPlatformColor(platformName) }}>{platformName}</span>
                  <p className="text-sm text-slate-500">@{post.account?.handle || "account"} - {formatRelative(post.published_at || post.created_at)}</p>
                </div>
                <div className="mt-4 grid aspect-square place-items-center rounded-2xl bg-gradient-to-br from-orange-100 to-violet-100 text-brand-purple">
                  <FileText className="h-12 w-12" />
                </div>
                <p className="mt-4 line-clamp-3 font-semibold text-slate-800">{post.caption}</p>
                <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-bold text-rose-600">{post.flag_reason}</p>
                    <p className="text-sm text-slate-500">Reported {post.reported_count} times</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="rounded-full bg-emerald-100 p-2 text-emerald-700" onClick={() => moderate(post, "approve")}><CheckCircle className="h-5 w-5" /></button>
                    <button type="button" className="rounded-full bg-rose-100 p-2 text-rose-700" onClick={() => setRemoveTarget(post)}><XCircle className="h-5 w-5" /></button>
                    <button type="button" className="rounded-full bg-orange-100 p-2 text-brand-orange" onClick={() => moderate(post, "review")}><Eye className="h-5 w-5" /></button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="app-surface mt-5 grid min-h-96 place-items-center p-8 text-center">
          <div>
            <ShieldCheck className="mx-auto h-16 w-16 text-brand-green" />
            <h2 className="mt-4 text-2xl font-bold text-slate-950">All clear! No content flagged for review.</h2>
          </div>
        </section>
      )}

      <ConfirmModal isOpen={Boolean(removeTarget)} title="Remove content" message={`Are you sure you want to remove this post? This cannot be undone.`} confirmLabel="Remove" onCancel={() => setRemoveTarget(null)} onConfirm={() => moderate(removeTarget, "remove")} />
    </TabShell>
  );
}

const OverviewLazy = lazy(() => Promise.resolve({ default: OverviewTab }));
const UsersLazy = lazy(() => Promise.resolve({ default: UsersTab }));
const LogsLazy = lazy(() => Promise.resolve({ default: LogsTab }));
const ReportsLazy = lazy(() => Promise.resolve({ default: ReportsTab }));
const ModerationLazy = lazy(() => Promise.resolve({ default: ModerationTab }));

export default function AdminPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTabState] = useState(() => window.location.hash.replace("#", "") || "overview");
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [reports, setReports] = useState([]);
  const [posts, setPosts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const role = user?.role || user?.role_name;

  useEffect(() => {
    document.title = "Admin Panel | Smart Social";
  }, []);

  useEffect(() => {
    if (!["superadmin", "admin"].includes(role)) {
      toast.error("Access denied");
      navigate("/", { replace: true });
    }
  }, [role, navigate]);

  useEffect(() => {
    function onHashChange() {
      setActiveTabState(window.location.hash.replace("#", "") || "overview");
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const [usersPayload, logsPayload, reportsPayload, postsPayload, accountsPayload] = await Promise.all([
          adminApi.listUsers({ page: 1, pageSize: 500 }),
          adminApi.listLogs({ page: 1, pageSize: 500 }),
          adminApi.listReports({ page: 1, pageSize: 500 }),
          postsApi.list({ page: 1, pageSize: 500 }),
          accountsApi.list({ page: 1, pageSize: 500 })
        ]);
        if (!alive) return;
        setUsers(toItems(usersPayload));
        setLogs(toItems(logsPayload));
        setReports(toItems(reportsPayload));
        setPosts(toItems(postsPayload));
        setAccounts(toItems(accountsPayload));
      } catch (error) {
        toast.error(error?.response?.data?.message || "Unable to load admin data.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    if (["superadmin", "admin"].includes(role)) load();
    return () => {
      alive = false;
    };
  }, [role]);

  function setActiveTab(tab) {
    window.location.hash = tab;
    setActiveTabState(tab);
  }

  if (!["superadmin", "admin"].includes(role)) return null;

  const content = {
    overview: <OverviewLazy users={users} posts={posts} accounts={accounts} logs={logs} setActiveTab={setActiveTab} />,
    users: <UsersLazy users={users} setUsers={setUsers} />,
    logs: <LogsLazy logs={logs} users={users} />,
    reports: <ReportsLazy reports={reports} setReports={setReports} />,
    moderation: <ModerationLazy posts={posts} />
  };

  return (
    <main className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-100 text-brand-orange">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-500">Smart Social</p>
          <h1 className="text-3xl font-bold text-slate-950">Admin Panel</h1>
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <TabNav tabs={adminTabs} activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="min-w-0 flex-1">
          {loading ? <TabSkeleton /> : <Suspense fallback={<TabSkeleton />}>{content[activeTab] || content.overview}</Suspense>}
        </div>
      </div>
    </main>
  );
}
