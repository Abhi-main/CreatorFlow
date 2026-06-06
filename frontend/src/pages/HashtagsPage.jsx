/* This page manages the hashtag cloud, CRUD actions, and per-tag analytics. */
import { useEffect, useState } from "react";
import { hashtagsApi } from "../api/services";
import { DataTable, PageCard, PaginationControls } from "../components/shared/Ui";

export default function HashtagsPage() {
  const [payload, setPayload] = useState({ items: [], pagination: null });
  const [selected, setSelected] = useState(null);
  const [analytics, setAnalytics] = useState([]);
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    hashtagsApi.list().then((response) => {
      setPayload(response);
      if (response.items[0]) {
        setSelected(response.items[0]);
      }
    });
  }, []);

  useEffect(() => {
    if (!selected) {
      return;
    }
    hashtagsApi.analytics(selected.id).then(setAnalytics);
  }, [selected]);

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <PageCard title="Hashtag cloud" subtitle="Add, remove, and review hashtag usage">
          <div className="flex flex-wrap gap-3">
            {payload.items.map((hashtag) => (
              <button
                key={hashtag.id}
                type="button"
                onClick={() => setSelected(hashtag)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  selected?.id === hashtag.id
                    ? "border-brand-orange bg-orange-50 text-slate-950 shadow-sm"
                    : "border-slate-300 bg-white text-slate-700 hover:border-brand-orange hover:bg-orange-50 hover:text-slate-950"
                }`}
              >
                {hashtag.tag}
              </button>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <input className="app-input flex-1" value={newTag} onChange={(event) => setNewTag(event.target.value)} placeholder="Add hashtag" />
            <button type="button" onClick={async () => { await hashtagsApi.create({ tag: newTag }); setNewTag(""); const refreshed = await hashtagsApi.list(); setPayload(refreshed); }} className="app-button-success">Add</button>
          </div>
        </PageCard>

        <PageCard title="Hashtag analytics">
          <DataTable
            columns={[
              { key: "impressions", label: "Reach", render: (row) => row.reach_count },
              { key: "engagement_count", label: "Engagement" },
              { key: "captured_at", label: "Captured", render: (row) => new Date(row.captured_at).toLocaleDateString() }
            ]}
            rows={analytics}
          />
        </PageCard>
      </section>

      <PageCard title="Hashtag table">
        <DataTable
          columns={[
            { key: "tag", label: "Tag" },
            { key: "category", label: "Category" },
            { key: "usage_count", label: "Usage count" },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <button type="button" onClick={async () => { await hashtagsApi.remove(row.id); const refreshed = await hashtagsApi.list(); setPayload(refreshed); }} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100">Delete</button>
              )
            }
          ]}
          rows={payload.items}
        />
        <PaginationControls pagination={payload.pagination} onPageChange={async (page) => setPayload(await hashtagsApi.list({ page }))} />
      </PageCard>
    </div>
  );
}
