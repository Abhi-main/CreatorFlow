import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Archive,
  BarChart2,
  Edit3,
  Eye,
  FileText,
  Grid3X3,
  List,
  Megaphone,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Trash2,
  TrendingUp
} from "lucide-react";
import ConfirmModal from "../components/shared/ConfirmModal";
import { StatCard } from "../components/shared/Ui";
import { campaignsApi } from "../api/services";
import { formatDate, formatNumber, getStatusColor } from "../utils/formatters";

function toItems(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.items || [];
}

function getCampaignRange(campaign) {
  const start = campaign.starts_at ? new Date(campaign.starts_at) : null;
  const end = campaign.ends_at ? new Date(campaign.ends_at) : null;

  if (!start && !end) return "No dates set";
  if (!end) return start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  const startText = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endText = end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${startText} - ${endText}`;
}

function getTimingLabel(campaign) {
  const now = new Date();
  const start = campaign.starts_at ? new Date(campaign.starts_at) : null;
  const end = campaign.ends_at ? new Date(campaign.ends_at) : null;

  if (end && end < now) return { label: "Completed", className: "bg-emerald-100 text-emerald-700" };
  if (start && start > now) {
    const days = Math.max(1, Math.ceil((start - now) / 86_400_000));
    return { label: `Starts in ${days} days`, className: "bg-blue-100 text-blue-700" };
  }
  if (end) {
    const days = Math.max(0, Math.ceil((end - now) / 86_400_000));
    return { label: `${days} days remaining`, className: "bg-orange-100 text-orange-700" };
  }

  return { label: "Ongoing", className: "bg-orange-100 text-orange-700" };
}

function statusBanner(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active") return "from-emerald-400 to-teal-500";
  if (normalized === "paused") return "from-yellow-300 to-orange-400";
  if (normalized === "completed") return "from-blue-400 to-cyan-500";
  if (normalized === "archived") return "from-slate-400 to-slate-600";
  return "from-brand-orange to-brand-purple";
}

function statusBadge(status) {
  return <span className={`rounded-full border px-3 py-1 text-xs font-bold capitalize ${getStatusColor(status)}`}>{status || "draft"}</span>;
}

function CampaignSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-2xl bg-white/80" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-80 animate-pulse rounded-2xl bg-white/80" />
        ))}
      </div>
    </div>
  );
}

function CampaignCard({ campaign, metrics, menuOpen, onMenu, onNavigate, onStatus, onArchive, onDelete }) {
  const timing = getTimingLabel(campaign);
  const totalPosts = metrics?.totalPosts || campaign.posts_count || 0;
  const publishedPosts = metrics?.publishedPosts || 0;
  const progress = totalPosts ? Math.min(100, Math.round((publishedPosts / totalPosts) * 100)) : 0;

  return (
    <article className="app-surface group overflow-hidden p-5 transition hover:-translate-y-1 hover:shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-950">{campaign.name}</h2>
          <div className="mt-2">{statusBadge(campaign.status)}</div>
        </div>
        <div className="relative">
          <button type="button" className="rounded-full p-2 text-slate-500 hover:bg-slate-100" onClick={onMenu}>
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-10 z-20 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-orange-50" onClick={onNavigate}>
                <Edit3 className="h-4 w-4" />
                Edit
              </button>
              <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-orange-50" onClick={onStatus}>
                {campaign.status === "paused" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {campaign.status === "paused" ? "Resume" : "Pause"}
              </button>
              <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-orange-50" onClick={onArchive}>
                <Archive className="h-4 w-4" />
                Archive
              </button>
              <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <button type="button" className={`mt-5 w-full rounded-2xl bg-gradient-to-br ${statusBanner(campaign.status)} p-4 text-left text-white`} onClick={onNavigate}>
        <p className="text-sm font-bold">{getCampaignRange(campaign)}</p>
        <span className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-bold ${timing.className}`}>{timing.label}</span>
      </button>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-slate-50 p-3">
          <FileText className="h-4 w-4 text-brand-orange" />
          <p className="mt-2 text-lg font-bold text-slate-950">{formatNumber(totalPosts)}</p>
          <p className="text-xs text-slate-500">Posts</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <Eye className="h-4 w-4 text-brand-purple" />
          <p className="mt-2 text-lg font-bold text-slate-950">{formatNumber(metrics?.reach || 0)}</p>
          <p className="text-xs text-slate-500">Reach</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <TrendingUp className="h-4 w-4 text-brand-green" />
          <p className="mt-2 text-lg font-bold text-slate-950">{metrics?.engagementRate || 0}%</p>
          <p className="text-xs text-slate-500">Eng.</p>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex justify-between text-xs font-bold text-slate-500">
          <span>{publishedPosts} / {totalPosts} posts published</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-orange" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{campaign.budget ? `Budget: ₹${formatNumber(campaign.budget)}` : "Budget: Not set"}</p>
        <button type="button" className="app-button-secondary py-2" onClick={onNavigate}>
          View Details
        </button>
      </div>
    </article>
  );
}

export default function Campaigns() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [campaigns, setCampaigns] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [menuId, setMenuId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [view, setView] = useState(() => localStorage.getItem("campaignView") || "grid");

  const page = Number(searchParams.get("page") || 1);
  const limit = view === "grid" ? 12 : 20;

  useEffect(() => {
    document.title = "Campaigns | Smart Social";
  }, []);

  useEffect(() => {
    localStorage.setItem("campaignView", view);
  }, [view]);

  async function loadCampaigns() {
    setLoading(true);
    try {
      const payload = await campaignsApi.list({ page: 1, pageSize: 100 });
      const items = toItems(payload);
      setCampaigns(items);
      const analyticsPairs = await Promise.all(
        items.map(async (campaign) => {
          try {
            const result = await campaignsApi.analytics(campaign.id);
            const posts = result?.posts || [];
            const summary = result?.summary || {};
            const engagement = posts.reduce((sum, post) => sum + Number(post.analytics?.engagement_count || 0), 0);
            const reach = Number(summary.reach_count || posts.reduce((sum, post) => sum + Number(post.analytics?.reach_count || 0), 0));
            const publishedPosts = posts.filter((post) => post.publish_status === "published").length;
            const engagementRate = reach ? ((engagement / reach) * 100).toFixed(1) : Number(summary.roi || 0).toFixed(1);
            return [campaign.id, { reach, engagementRate, totalPosts: posts.length, publishedPosts }];
          } catch {
            return [campaign.id, { reach: 0, engagementRate: 0, totalPosts: 0, publishedPosts: 0 }];
          }
        })
      );
      setAnalytics(Object.fromEntries(analyticsPairs));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load campaigns.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  const stats = useMemo(() => {
    const totalReach = Object.values(analytics).reduce((sum, item) => sum + Number(item.reach || 0), 0);
    const avgEngagement = Object.values(analytics).length
      ? (Object.values(analytics).reduce((sum, item) => sum + Number(item.engagementRate || 0), 0) / Object.values(analytics).length).toFixed(1)
      : "0.0";

    return {
      total: campaigns.length,
      active: campaigns.filter((campaign) => campaign.status === "active").length,
      totalReach,
      avgEngagement
    };
  }, [campaigns, analytics]);

  const visibleCampaigns = useMemo(() => campaigns.slice((page - 1) * limit, page * limit), [campaigns, page, limit]);
  const totalPages = Math.max(1, Math.ceil(campaigns.length / limit));

  async function updateCampaignStatus(campaign, status) {
    setBusy(true);
    try {
      await campaignsApi.update(campaign.id, { status });
      await loadCampaigns();
      setMenuId(null);
      toast.success("Campaign updated.", { duration: 3000 });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to update campaign.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await campaignsApi.remove(deleteTarget.id);
      setCampaigns((current) => current.filter((campaign) => campaign.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success("Campaign deleted.", { duration: 3000 });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to delete campaign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-100 text-brand-orange">
            <Megaphone className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500">Smart Social</p>
            <h1 className="text-3xl font-bold text-slate-950">Campaigns</h1>
          </div>
        </div>
        <button type="button" className="app-button-primary gap-2" onClick={() => navigate("/campaigns/new")}>
          <Plus className="h-4 w-4" />
          New Campaign
        </button>
      </div>

      {loading ? (
        <CampaignSkeleton />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Total Campaigns" value={formatNumber(stats.total)} change="All campaigns" icon={Megaphone} color="orange" />
            <StatCard title="Active Campaigns" value={formatNumber(stats.active)} change={`${stats.active} active`} icon={Play} color="green" />
            <StatCard title="Total Reach" value={formatNumber(stats.totalReach)} change="Across campaigns" icon={Eye} color="blue" />
            <StatCard title="Avg Engagement Rate" value={`${stats.avgEngagement}%`} change="Campaign average" icon={BarChart2} color="purple" />
          </section>

          <section className="space-y-4">
            <div className="flex justify-end">
              <div className="rounded-2xl border border-slate-200 bg-white p-1 shadow-soft">
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 font-bold ${view === "grid" ? "bg-brand-orange text-white" : "text-slate-600"}`}
                  onClick={() => setView("grid")}
                >
                  <Grid3X3 className="h-4 w-4" />
                  Grid
                </button>
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 font-bold ${view === "list" ? "bg-brand-orange text-white" : "text-slate-600"}`}
                  onClick={() => setView("list")}
                >
                  <List className="h-4 w-4" />
                  List
                </button>
              </div>
            </div>

            {view === "grid" ? (
              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {visibleCampaigns.map((campaign) => (
                  <CampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    metrics={analytics[campaign.id]}
                    menuOpen={menuId === campaign.id}
                    onMenu={() => setMenuId((current) => (current === campaign.id ? null : campaign.id))}
                    onNavigate={() => navigate(`/campaigns/${campaign.id}`)}
                    onStatus={() => updateCampaignStatus(campaign, campaign.status === "paused" ? "active" : "paused")}
                    onArchive={() => updateCampaignStatus(campaign, "archived")}
                    onDelete={() => setDeleteTarget(campaign)}
                  />
                ))}
              </div>
            ) : (
              <div className="app-surface overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.22em] text-slate-400">
                      <tr>
                        {["Name", "Status", "Date Range", "Posts", "Total Reach", "Engagement Rate", "Budget", "Actions"].map((heading) => (
                          <th key={heading} className="px-4 py-4 font-bold">{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleCampaigns.map((campaign) => (
                        <tr key={campaign.id} className="hover:bg-orange-50/40">
                          <td className="px-4 py-4 font-bold text-slate-950">{campaign.name}</td>
                          <td className="px-4 py-4">{statusBadge(campaign.status)}</td>
                          <td className="px-4 py-4 text-slate-600">{getCampaignRange(campaign)}</td>
                          <td className="px-4 py-4 text-slate-600">{formatNumber(analytics[campaign.id]?.totalPosts || 0)}</td>
                          <td className="px-4 py-4 text-slate-600">{formatNumber(analytics[campaign.id]?.reach || 0)}</td>
                          <td className="px-4 py-4 text-slate-600">{analytics[campaign.id]?.engagementRate || 0}%</td>
                          <td className="px-4 py-4 text-slate-600">{campaign.budget ? `₹${formatNumber(campaign.budget)}` : "-"}</td>
                          <td className="px-4 py-4">
                            <div className="flex gap-1">
                              <button type="button" className="rounded-full p-2 text-slate-500 hover:bg-orange-50 hover:text-brand-orange" onClick={() => navigate(`/campaigns/${campaign.id}`)}>
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button type="button" className="rounded-full p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600" onClick={() => setDeleteTarget(campaign)}>
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">
              <p>Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <button type="button" className="app-button-secondary py-2" disabled={page <= 1} onClick={() => setSearchParams({ page: String(page - 1) })}>
                  Previous
                </button>
                <button type="button" className="app-button-secondary py-2" disabled={page >= totalPages} onClick={() => setSearchParams({ page: String(page + 1) })}>
                  Next
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        busy={busy}
        message={`Are you sure you want to delete ${deleteTarget?.name || "this campaign"}? This cannot be undone.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </main>
  );
}
