import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BarChart2, Edit3, Hash, Plus, Search, Trash2 } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import ConfirmModal from "../components/shared/ConfirmModal";
import { StatCard } from "../components/shared/Ui";
import { hashtagsApi } from "../api/services";
import { formatNumber, hashColor } from "../utils/formatters";

function toItems(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.items || [];
}

function normalizeTag(tag) {
  const value = String(tag || "").trim().toLowerCase();
  if (!value) return "";
  return value.startsWith("#") ? value : `#${value}`;
}

function summarizeAnalytics(records = []) {
  const totalReach = records.reduce((sum, item) => sum + Number(item.reach_count || 0), 0);
  const totalEngagement = records.reduce((sum, item) => sum + Number(item.engagement_count || 0), 0);
  const avgReach = records.length ? Math.round(totalReach / records.length) : 0;
  const avgEngagement = totalReach ? Number(((totalEngagement / totalReach) * 100).toFixed(1)) : 0;
  const best = records.reduce((winner, item) => (Number(item.reach_count || 0) > Number(winner?.reach_count || 0) ? item : winner), null);

  return {
    totalReach,
    avgReach,
    avgEngagement,
    bestDay: best?.captured_at ? format(new Date(best.captured_at), "EEEE") : "-"
  };
}

function HashtagSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-2xl bg-white/80" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="h-[32rem] animate-pulse rounded-2xl bg-white/80" />
        <div className="h-[32rem] animate-pulse rounded-2xl bg-white/80" />
      </div>
    </div>
  );
}

function EditHashtagModal({ hashtag, draft, onDraft, onCancel, onSubmit, busy }) {
  if (!hashtag) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 backdrop-blur-sm">
      <form className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" onSubmit={onSubmit}>
        <h2 className="text-xl font-bold text-slate-950">Edit hashtag</h2>
        <label className="mt-5 block">
          <span className="text-sm font-bold text-slate-700">Hashtag</span>
          <input className="app-input mt-2" value={draft.tag} onChange={(event) => onDraft({ ...draft, tag: event.target.value })} />
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-bold text-slate-700">Category</span>
          <input className="app-input mt-2" value={draft.category} onChange={(event) => onDraft({ ...draft, category: event.target.value })} />
        </label>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="app-button-secondary py-2.5" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="app-button-primary py-2.5" disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function AnalyticsPanel({ selected, analytics, related, onSelect }) {
  if (!selected) {
    return (
      <section className="app-surface sticky top-4 grid min-h-[30rem] place-items-center p-8 text-center">
        <div>
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-slate-100 text-slate-300">
            <Hash className="h-10 w-10" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-slate-950">Select a hashtag to view its analytics</h2>
          <p className="mt-2 text-sm text-slate-500">Reach trends, engagement quality, and related tags will appear here.</p>
        </div>
      </section>
    );
  }

  const summary = summarizeAnalytics(analytics);
  const chartData = analytics.map((record) => ({
    date: format(new Date(record.captured_at || Date.now()), "MMM d"),
    reach: Number(record.reach_count || 0)
  }));

  return (
    <section className="app-surface sticky top-4 p-5">
      <div>
        <h2 className="text-3xl font-black" style={{ color: hashColor(selected.tag) }}>{selected.tag}</h2>
        <span className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize text-slate-600">{selected.category || "general"}</span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {[
          ["Total Posts Used", formatNumber(selected.usage_count || 0)],
          ["Avg Reach per post", formatNumber(summary.avgReach)],
          ["Avg Engagement Rate", `${summary.avgEngagement}%`],
          ["Best Performing Day", summary.bestDay]
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-gradient-to-br from-orange-50 to-violet-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
            <p className="mt-2 text-lg font-bold text-slate-950">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-bold text-slate-950">Reach Over Time</h3>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="reach" stroke="#F5A623" strokeWidth={3} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-bold text-slate-950">Often used with:</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {related.map((item) => (
            <button
              key={item.id}
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-bold text-slate-700 hover:border-brand-orange hover:text-brand-orange"
              onClick={() => onSelect(item)}
            >
              {item.tag}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Hashtags() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [hashtags, setHashtags] = useState([]);
  const [analyticsMap, setAnalyticsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState("cloud");
  const [selected, setSelected] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editDraft, setEditDraft] = useState({ tag: "", category: "" });

  const search = searchParams.get("search") || "";
  const sort = searchParams.get("sort") || "avg_reach";
  const order = searchParams.get("order") || "desc";
  const page = Number(searchParams.get("page") || 1);
  const limit = Number(searchParams.get("limit") || 20);

  useEffect(() => {
    document.title = "Hashtags | Smart Social";
  }, []);

  async function loadHashtags() {
    setLoading(true);
    try {
      const payload = await hashtagsApi.list({ page: 1, pageSize: 500 });
      const items = toItems(payload);
      const analyticsPairs = await Promise.all(
        items.map(async (hashtag) => {
          try {
            return [hashtag.id, await hashtagsApi.analytics(hashtag.id)];
          } catch {
            return [hashtag.id, []];
          }
        })
      );
      setHashtags(items);
      setAnalyticsMap(Object.fromEntries(analyticsPairs));
      setSelected((current) => current || items[0] || null);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load hashtags.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHashtags();
  }, []);

  const enriched = useMemo(() => {
    return hashtags.map((hashtag) => ({
      ...hashtag,
      ...summarizeAnalytics(analyticsMap[hashtag.id] || [])
    }));
  }, [hashtags, analyticsMap]);

  const stats = useMemo(() => {
    const topReach = [...enriched].sort((left, right) => right.totalReach - left.totalReach)[0];
    const mostUsed = [...enriched].sort((left, right) => Number(right.usage_count || 0) - Number(left.usage_count || 0))[0];
    const avgEngagement = enriched.length ? (enriched.reduce((sum, item) => sum + Number(item.avgEngagement || 0), 0) / enriched.length).toFixed(1) : "0.0";

    return {
      total: enriched.length,
      topReach,
      avgEngagement,
      mostUsed
    };
  }, [enriched]);

  const filtered = useMemo(() => {
    const searched = enriched.filter((item) => item.tag.toLowerCase().includes(search.toLowerCase()) || String(item.category || "").toLowerCase().includes(search.toLowerCase()));
    const sorted = [...searched].sort((left, right) => {
      const leftValue = sort === "tag" ? left.tag : sort === "category" ? left.category : sort === "usage_count" ? left.usage_count : sort === "avg_engagement" ? left.avgEngagement : left.avgReach;
      const rightValue = sort === "tag" ? right.tag : sort === "category" ? right.category : sort === "usage_count" ? right.usage_count : sort === "avg_engagement" ? right.avgEngagement : right.avgReach;
      const result = typeof leftValue === "string" ? String(leftValue).localeCompare(String(rightValue)) : Number(leftValue || 0) - Number(rightValue || 0);
      return order === "asc" ? result : -result;
    });
    return sorted;
  }, [enriched, search, sort, order]);

  const pageItems = filtered.slice((page - 1) * limit, page * limit);
  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const related = selected
    ? enriched.filter((item) => item.id !== selected.id && (item.category === selected.category || item.tag.length % 2 === selected.tag.length % 2)).slice(0, 6)
    : [];

  function setQuery(key, value) {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.set("page", "1");
    setSearchParams(next);
  }

  function toggleSort(column) {
    const nextOrder = sort === column && order === "desc" ? "asc" : "desc";
    setQuery("sort", column);
    const next = new URLSearchParams(searchParams);
    next.set("sort", column);
    next.set("order", nextOrder);
    next.set("page", "1");
    setSearchParams(next);
  }

  function openEdit(hashtag) {
    setEditTarget(hashtag);
    setEditDraft({ tag: hashtag.tag, category: hashtag.category || "" });
  }

  async function submitEdit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const updated = await hashtagsApi.update(editTarget.id, { tag: normalizeTag(editDraft.tag), category: editDraft.category });
      setHashtags((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      if (selected?.id === updated.id) setSelected(updated);
      setEditTarget(null);
      toast.success("Hashtag updated.", { duration: 3000 });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to update hashtag.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteHashtag() {
    setBusy(true);
    try {
      await hashtagsApi.remove(deleteTarget.id);
      setHashtags((current) => current.filter((item) => item.id !== deleteTarget.id));
      if (selected?.id === deleteTarget.id) setSelected(null);
      setDeleteTarget(null);
      toast.success("Hashtag deleted.", { duration: 3000 });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to delete hashtag.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-100 text-brand-orange">
            <Hash className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500">Smart Social</p>
            <h1 className="text-3xl font-bold text-slate-950">Hashtags</h1>
          </div>
        </div>
        <button type="button" className="app-button-primary gap-2" onClick={() => navigate("/hashtags/new")}>
          <Plus className="h-4 w-4" />
          Add Hashtag
        </button>
      </div>

      {loading ? (
        <HashtagSkeleton />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Total Hashtags" value={formatNumber(stats.total)} change="Tracked tags" icon={Hash} color="orange" />
            <StatCard title="Top Reach" value={stats.topReach?.tag || "-"} change={`${formatNumber(stats.topReach?.totalReach || 0)} reach`} icon={BarChart2} color="green" />
            <StatCard title="Avg Engagement Rate" value={`${stats.avgEngagement}%`} change="All hashtags" icon={BarChart2} color="purple" />
            <StatCard title="Most Used" value={stats.mostUsed?.tag || "-"} change={`${formatNumber(stats.mostUsed?.usage_count || 0)} posts`} icon={Hash} color="blue" />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <div className="app-surface p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">{view === "cloud" ? "Tag Cloud" : "Hashtag Table"}</h2>
                  <p className="mt-1 text-sm text-slate-500">Explore reach, engagement, and category performance.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-1">
                  <button type="button" className={`rounded-xl px-4 py-2 font-bold ${view === "cloud" ? "bg-brand-orange text-white" : "text-slate-600"}`} onClick={() => setView("cloud")}>
                    Cloud
                  </button>
                  <button type="button" className={`rounded-xl px-4 py-2 font-bold ${view === "table" ? "bg-brand-orange text-white" : "text-slate-600"}`} onClick={() => setView("table")}>
                    Table
                  </button>
                </div>
              </div>

              {view === "cloud" ? (
                <div className="mt-6 flex min-h-[25rem] flex-wrap content-start gap-3">
                  {enriched.map((hashtag) => {
                    const color = hashColor(hashtag.tag);
                    const size = hashtag.avgReach > 5000 ? "text-xl px-5 py-3" : hashtag.avgReach > 2000 ? "text-base px-4 py-2.5" : "text-sm px-3 py-2";
                    const active = selected?.id === hashtag.id;
                    return (
                      <button
                        key={hashtag.id}
                        type="button"
                        title={`Reach: ${formatNumber(hashtag.totalReach)} | Avg engagement: ${hashtag.avgEngagement}%`}
                        className={`rounded-full border-2 font-black shadow-sm transition hover:-translate-y-0.5 ${size} ${active ? "ring-4 ring-orange-100" : ""}`}
                        style={{ borderColor: color, backgroundColor: active ? color : `${color}1A`, color: active ? "#ffffff" : color }}
                        onClick={() => setSelected(hashtag)}
                      >
                        {hashtag.tag}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input className="app-input pl-11" value={search} onChange={(event) => setQuery("search", event.target.value)} placeholder="Search hashtags..." />
                  </label>
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-[0.22em] text-slate-400">
                        <tr>
                          {[
                            ["#", ""],
                            ["Hashtag", "tag"],
                            ["Category", "category"],
                            ["Posts Used", "usage_count"],
                            ["Avg Reach", "avg_reach"],
                            ["Avg Engagement", "avg_engagement"],
                            ["Actions", ""]
                          ].map(([heading, key]) => (
                            <th key={heading} className="px-4 py-4 font-bold">
                              {key ? (
                                <button type="button" className="hover:text-brand-orange" onClick={() => toggleSort(key)}>
                                  {heading}
                                </button>
                              ) : heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pageItems.map((hashtag, index) => (
                          <tr key={hashtag.id} className="hover:bg-orange-50/40">
                            <td className="px-4 py-4 font-bold text-slate-500">{(page - 1) * limit + index + 1}</td>
                            <td className="px-4 py-4 font-black" style={{ color: hashColor(hashtag.tag) }}>{hashtag.tag}</td>
                            <td className="px-4 py-4 capitalize text-slate-600">{hashtag.category || "general"}</td>
                            <td className="px-4 py-4 text-slate-600">{formatNumber(hashtag.usage_count || 0)}</td>
                            <td className="px-4 py-4 text-slate-600">{formatNumber(hashtag.avgReach)}</td>
                            <td className="px-4 py-4 text-slate-600">{hashtag.avgEngagement}%</td>
                            <td className="px-4 py-4">
                              <div className="flex gap-1">
                                <button type="button" className="rounded-full p-2 text-slate-500 hover:bg-orange-50 hover:text-brand-orange" onClick={() => openEdit(hashtag)}>
                                  <Edit3 className="h-4 w-4" />
                                </button>
                                <button type="button" className="rounded-full p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600" onClick={() => setDeleteTarget(hashtag)}>
                                  <Trash2 className="h-4 w-4" />
                                </button>
                                <button type="button" className="rounded-full p-2 text-slate-500 hover:bg-violet-50 hover:text-brand-purple" onClick={() => setSelected(hashtag)}>
                                  <BarChart2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <p>Page {page} of {totalPages}</p>
                    <div className="flex items-center gap-2">
                      <select className="app-input w-24 py-2" value={limit} onChange={(event) => setQuery("limit", event.target.value)}>
                        {[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
                      </select>
                      <button type="button" className="app-button-secondary py-2" disabled={page <= 1} onClick={() => setQuery("page", String(page - 1))}>Prev</button>
                      <button type="button" className="app-button-secondary py-2" disabled={page >= totalPages} onClick={() => setQuery("page", String(page + 1))}>Next</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <AnalyticsPanel selected={selected} analytics={analyticsMap[selected?.id] || []} related={related} onSelect={setSelected} />
          </section>
        </>
      )}

      <EditHashtagModal
        hashtag={editTarget}
        draft={editDraft}
        onDraft={setEditDraft}
        onCancel={() => setEditTarget(null)}
        onSubmit={submitEdit}
        busy={busy}
      />
      <ConfirmModal
        open={Boolean(deleteTarget)}
        busy={busy}
        message={`Are you sure you want to delete ${deleteTarget?.tag || "this hashtag"}? This cannot be undone.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteHashtag}
      />
    </main>
  );
}
