/* This page renders the filterable post-history table and inline actions. */
import { format } from "date-fns";
import { Filter, Send, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { accountsApi, postsApi } from "../api/services";
import { DataTable, PageCard, PaginationControls, StatusBadge } from "../components/shared/Ui";

export default function PostsPage() {
  const [accounts, setAccounts] = useState([]);
  const [payload, setPayload] = useState({ items: [], pagination: null });
  const [filters, setFilters] = useState({ page: 1, status: "", account: "", platform: "", dateFrom: "", dateTo: "" });

  useEffect(() => {
    accountsApi.list().then((response) => setAccounts(response.items));
  }, []);

  useEffect(() => {
    postsApi.list(filters).then(setPayload);
  }, [filters]);

  async function refreshPosts(nextFilters = filters) {
    setPayload(await postsApi.list(nextFilters));
  }

  return (
    <PageCard title="Post history" subtitle="Filterable publishing history across connected channels">
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-violet-600">
        <Filter className="h-3.5 w-3.5" />
        Filters
      </div>

      <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-5">
        <select
          className="rounded-2xl border border-violet-100 bg-white px-4 py-3.5 text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
          value={filters.status}
          onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="published">Published</option>
        </select>

        <select
          className="rounded-2xl border border-violet-100 bg-white px-4 py-3.5 text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
          value={filters.account}
          onChange={(event) => setFilters((current) => ({ ...current, account: event.target.value, page: 1 }))}
        >
          <option value="">All accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.account_name}
            </option>
          ))}
        </select>

        <input
          className="rounded-2xl border border-violet-100 bg-white px-4 py-3.5 text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
          type="date"
          value={filters.dateFrom}
          onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value, page: 1 }))}
        />
        <input
          className="rounded-2xl border border-violet-100 bg-white px-4 py-3.5 text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
          type="date"
          value={filters.dateTo}
          onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value, page: 1 }))}
        />

        <button
          type="button"
          onClick={() => setFilters({ page: 1, status: "", account: "", platform: "", dateFrom: "", dateTo: "" })}
          className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3.5 font-semibold text-orange-700 transition hover:bg-orange-100"
        >
          Reset filters
        </button>
      </div>

      <div className="mt-6">
        <DataTable
          columns={[
            {
              key: "title",
              label: "Post",
              render: (row) => (
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900">{row.title}</p>
                  <p className="max-w-md text-xs leading-5 text-slate-500">{row.caption.slice(0, 90)}</p>
                </div>
              )
            },
            { key: "account", label: "Account", render: (row) => row.account?.account_name || "Account" },
            { key: "publish_status", label: "Status", render: (row) => <StatusBadge>{row.publish_status}</StatusBadge> },
            {
              key: "scheduled_for",
              label: "Scheduled",
              render: (row) => (row.scheduled_for ? format(new Date(row.scheduled_for), "MMM d, yyyy 'at' h:mm aa") : "-")
            },
            { key: "engagement", label: "Engagement", render: (row) => row.analytics?.engagement_count || "-" },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await postsApi.publishNow(row.id);
                      await refreshPosts();
                      toast.success("Post published.");
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Publish
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await postsApi.remove(row.id);
                      await refreshPosts();
                      toast.success("Post deleted.");
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              )
            }
          ]}
          rows={payload.items}
        />
        <PaginationControls pagination={payload.pagination} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} />
      </div>
    </PageCard>
  );
}
