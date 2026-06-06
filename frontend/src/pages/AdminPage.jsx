/* This page exposes admin-only users, logs, and report workflows. */
import { useEffect, useState } from "react";
import { adminApi } from "../api/services";
import { useAuth } from "../context/AuthContext";
import { DataTable, PageCard, PaginationControls } from "../components/shared/Ui";

export default function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState({ items: [], pagination: null });
  const [logs, setLogs] = useState({ items: [], pagination: null });
  const [reports, setReports] = useState({ items: [], pagination: null });
  const [form, setForm] = useState({ report_type: "weekly", report_name: "New Report", format: "pdf" });

  useEffect(() => {
    if (!["admin", "superadmin"].includes(user?.role_name)) {
      return;
    }
    Promise.all([adminApi.listUsers(), adminApi.listLogs(), adminApi.listReports()]).then(([usersData, logsData, reportsData]) => {
      setUsers(usersData);
      setLogs(logsData);
      setReports(reportsData);
    });
  }, [user]);

  if (!["admin", "superadmin"].includes(user?.role_name)) {
    return <PageCard title="Admin panel"><p className="text-sm text-slate-400">You do not have access to the admin panel.</p></PageCard>;
  }

  return (
    <div className="space-y-6">
      <PageCard title="User management">
        <DataTable
          columns={[
            { key: "full_name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "role_name", label: "Role" },
            { key: "status", label: "Status" },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <button
                  type="button"
                  onClick={async () => {
                    await adminApi.updateUserStatus(row.id, { status: row.status === "active" ? "suspended" : "active" });
                    setUsers(await adminApi.listUsers());
                  }}
                  className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-100"
                >
                  {row.status === "active" ? "Ban" : "Unban"}
                </button>
              )
            }
          ]}
          rows={users.items}
        />
        <PaginationControls pagination={users.pagination} onPageChange={async (page) => setUsers(await adminApi.listUsers({ page }))} />
      </PageCard>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <PageCard title="System logs">
          <DataTable
            columns={[
              { key: "source", label: "Source" },
              { key: "level", label: "Level" },
              { key: "message", label: "Message" },
              { key: "created_at", label: "Time", render: (row) => new Date(row.created_at).toLocaleString() }
            ]}
            rows={logs.items}
          />
          <PaginationControls pagination={logs.pagination} onPageChange={async (page) => setLogs(await adminApi.listLogs({ page }))} />
        </PageCard>

        <PageCard title="Reports">
          <form
            className="grid gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              await adminApi.createReport(form);
              setReports(await adminApi.listReports());
            }}
          >
            <input className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" value={form.report_name} onChange={(event) => setForm((current) => ({ ...current, report_name: event.target.value }))} />
            <select className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" value={form.report_type} onChange={(event) => setForm((current) => ({ ...current, report_type: event.target.value }))}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="campaign">Campaign</option>
            </select>
            <select className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" value={form.format} onChange={(event) => setForm((current) => ({ ...current, format: event.target.value }))}>
              <option value="pdf">PDF</option>
              <option value="csv">CSV</option>
            </select>
            <button type="submit" className="rounded-2xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950">Queue report</button>
          </form>
          <div className="mt-6 space-y-3">
            {reports.items.map((report) => (
              <div key={report.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="font-medium text-white">{report.report_name}</p>
                <p className="text-sm text-slate-400">{report.file_path}</p>
              </div>
            ))}
          </div>
        </PageCard>
      </section>
    </div>
  );
}
