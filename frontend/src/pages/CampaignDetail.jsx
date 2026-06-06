import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";
import { Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { ArrowLeft, BarChart2, Check, Edit3, FileText, Megaphone, MousePointerClick, Plus, Save, Trash2, TrendingUp, X } from "lucide-react";
import ConfirmModal from "../components/shared/ConfirmModal";
import { StatCard } from "../components/shared/Ui";
import { accountsApi, campaignsApi, postsApi } from "../api/services";
import { formatDate, formatNumber, getPlatformColor, getStatusColor } from "../utils/formatters";

function toItems(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.items || [];
}

function getPostPlatform(post) {
  return String(post?.account?.platform?.slug || post?.account?.platform?.name || "instagram").toLowerCase();
}

function StatusBadge({ status }) {
  return <span className={`rounded-full border px-3 py-1 text-xs font-bold capitalize ${getStatusColor(status)}`}>{status || "draft"}</span>;
}

function CampaignDetailSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-24 animate-pulse rounded-2xl bg-white/80" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-2xl bg-white/80" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-96 animate-pulse rounded-2xl bg-white/80" />
        <div className="h-96 animate-pulse rounded-2xl bg-white/80" />
      </div>
    </div>
  );
}

function AddPostModal({ open, posts, accounts, selectedAccount, selectedPost, onAccountChange, onPostChange, onCancel, onSubmit, busy }) {
  if (!open) return null;

  const filteredPosts = selectedAccount ? posts.filter((post) => Number(post.social_account_id) === Number(selectedAccount)) : posts;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Add Post to Campaign</h2>
            <p className="mt-1 text-sm text-slate-500">Choose an account and an existing post to attach.</p>
          </div>
          <button type="button" className="rounded-full p-2 text-slate-500 hover:bg-slate-100" onClick={onCancel}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-bold text-slate-700">Account</span>
            <select className="app-input mt-2" value={selectedAccount} onChange={(event) => onAccountChange(event.target.value)}>
              <option value="">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  @{account.handle} - {account.platform?.name || "Platform"}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-700">Post</span>
            <select className="app-input mt-2" value={selectedPost} onChange={(event) => onPostChange(event.target.value)}>
              <option value="">Select post</option>
              {filteredPosts.map((post) => (
                <option key={post.id} value={post.id}>
                  {post.title || post.caption?.slice(0, 48) || `Post #${post.id}`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="app-button-secondary py-2.5" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="app-button-primary gap-2 py-2.5" onClick={onSubmit} disabled={busy || !selectedPost}>
            <Plus className="h-4 w-4" />
            Add Post
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [allPosts, setAllPosts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedPost, setSelectedPost] = useState("");

  useEffect(() => {
    document.title = "Campaign Detail | Smart Social";
  }, []);

  async function loadDetail() {
    setLoading(true);
    try {
      const [campaignPayload, analyticsPayload, postsPayload, accountsPayload] = await Promise.all([
        campaignsApi.get(id),
        campaignsApi.analytics(id),
        postsApi.list({ page: 1, pageSize: 500 }),
        accountsApi.list({ page: 1, pageSize: 100 })
      ]);
      setCampaign(campaignPayload);
      setNameDraft(campaignPayload.name);
      setAnalytics(analyticsPayload);
      setAllPosts(toItems(postsPayload));
      setAccounts(toItems(accountsPayload));
      document.title = `${campaignPayload.name} | Smart Social`;
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load campaign.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetail();
  }, [id]);

  const campaignPosts = analytics?.posts || allPosts.filter((post) => Number(post.campaign_id) === Number(id));

  const statSummary = useMemo(() => {
    const summary = analytics?.summary || {};
    const postTotals = campaignPosts.reduce(
      (totals, post) => ({
        reach: totals.reach + Number(post.analytics?.reach_count || 0),
        engagement: totals.engagement + Number(post.analytics?.engagement_count || 0),
        clicks: totals.clicks + Number(post.analytics?.clicks_count || 0)
      }),
      { reach: 0, engagement: 0, clicks: 0 }
    );

    return {
      posts: campaignPosts.length,
      reach: Number(summary.reach_count || postTotals.reach || 0),
      engagement: Number(summary.engagement_count || postTotals.engagement || 0),
      clicks: Number(summary.clicks_count || postTotals.clicks || 0)
    };
  }, [analytics, campaignPosts]);

  const chartData = useMemo(() => {
    const grouped = new Map();
    const daily = analytics?.daily || [];

    daily.forEach((record) => {
      const date = format(new Date(record.collected_at || record.stat_date || Date.now()), "MMM d");
      const current = grouped.get(date) || { date, reach: 0, engagement: 0, clicks: 0 };
      current.reach += Number(record.reach_count || 0);
      current.engagement += Number(record.engagement_count || 0);
      current.clicks += Number(record.clicks_count || 0);
      grouped.set(date, current);
    });

    if (!grouped.size && analytics?.summary) {
      const date = format(new Date(analytics.summary.captured_at || Date.now()), "MMM d");
      grouped.set(date, {
        date,
        reach: Number(analytics.summary.reach_count || 0),
        engagement: Number(analytics.summary.engagement_count || analytics.summary.clicks_count || 0),
        clicks: Number(analytics.summary.clicks_count || 0)
      });
    }

    return Array.from(grouped.values());
  }, [analytics]);

  const pieData = useMemo(() => {
    const labels = ["feed", "story", "reel", "carousel"];
    const counts = Object.fromEntries(labels.map((label) => [label, 0]));
    campaignPosts.forEach((post) => {
      const type = post.recurring_pattern?.type || labels[Number(post.id || 0) % labels.length];
      counts[type] = (counts[type] || 0) + 1;
    });
    return labels.map((label) => ({ name: label, value: counts[label] }));
  }, [campaignPosts]);

  async function saveName() {
    if (!nameDraft.trim() || nameDraft.trim() === campaign.name) {
      setEditingName(false);
      setNameDraft(campaign.name);
      return;
    }

    setBusy(true);
    try {
      const updated = await campaignsApi.update(id, { name: nameDraft.trim() });
      setCampaign(updated);
      setEditingName(false);
      toast.success("Campaign renamed.", { duration: 3000 });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to rename campaign.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCampaign() {
    setBusy(true);
    try {
      await campaignsApi.remove(id);
      toast.success("Campaign deleted.", { duration: 3000 });
      navigate("/campaigns");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to delete campaign.");
    } finally {
      setBusy(false);
    }
  }

  async function addPostToCampaign() {
    setBusy(true);
    try {
      await postsApi.update(selectedPost, { campaign_id: Number(id) });
      setAddOpen(false);
      setSelectedPost("");
      await loadDetail();
      toast.success("Post added to campaign.", { duration: 3000 });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to add post.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <CampaignDetailSkeleton />;
  if (!campaign) return null;

  return (
    <main className="space-y-6">
      <button type="button" className="inline-flex items-center gap-2 font-bold text-slate-500 hover:text-brand-orange" onClick={() => navigate("/campaigns")}>
        <ArrowLeft className="h-4 w-4" />
        Back to campaigns
      </button>

      <section className="app-surface flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-100 text-brand-orange">
            <Megaphone className="h-6 w-6" />
          </div>
          <div>
            {editingName ? (
              <div className="flex flex-wrap items-center gap-2">
                <input className="app-input max-w-md py-2 text-2xl font-bold" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} autoFocus />
                <button type="button" className="rounded-full bg-emerald-100 p-2 text-emerald-700" onClick={saveName} disabled={busy}>
                  <Check className="h-5 w-5" />
                </button>
                <button type="button" className="rounded-full bg-slate-100 p-2 text-slate-500" onClick={() => { setEditingName(false); setNameDraft(campaign.name); }}>
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <button type="button" className="group flex items-center gap-2 text-left" onClick={() => setEditingName(true)}>
                <h1 className="text-3xl font-bold text-slate-950">{campaign.name}</h1>
                <Edit3 className="h-4 w-4 text-slate-300 group-hover:text-brand-orange" />
              </button>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <StatusBadge status={campaign.status} />
              <span className="text-sm text-slate-500">{formatDate(campaign.starts_at)} to {formatDate(campaign.ends_at)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="app-button-secondary gap-2" onClick={() => setEditingName(true)}>
            <Edit3 className="h-4 w-4" />
            Edit
          </button>
          <button type="button" className="app-button-secondary gap-2 text-rose-600" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Posts" value={formatNumber(statSummary.posts)} change="In campaign" icon={FileText} color="orange" />
        <StatCard title="Total Reach" value={formatNumber(statSummary.reach)} change="Campaign reach" icon={TrendingUp} color="blue" />
        <StatCard title="Total Engagement" value={formatNumber(statSummary.engagement)} change="Likes, comments, shares" icon={BarChart2} color="purple" />
        <StatCard title="Total Clicks" value={formatNumber(statSummary.clicks)} change="Tracked clicks" icon={MousePointerClick} color="green" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="app-surface p-5">
          <h2 className="text-xl font-bold text-slate-950">Campaign Performance Over Time</h2>
          <div className="mt-6 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="reach" stroke="#F5A623" strokeWidth={3} dot />
                <Line type="monotone" dataKey="engagement" stroke="#7C4DFF" strokeWidth={3} dot />
                <Line type="monotone" dataKey="clicks" stroke="#00C896" strokeWidth={3} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="app-surface p-5">
          <h2 className="text-xl font-bold text-slate-950">Post Type Breakdown</h2>
          <div className="mt-6 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={115} paddingAngle={4}>
                  {pieData.map((entry, index) => (
                    <Cell key={entry.name} fill={["#F5A623", "#7C4DFF", "#00C896", "#FF4081"][index]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value} posts`, name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="app-surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Posts in this Campaign</h2>
            <p className="mt-1 text-sm text-slate-500">Campaign-filtered post performance and publishing status.</p>
          </div>
          <button type="button" className="app-button-primary gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Post to Campaign
          </button>
        </div>

        {campaignPosts.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.22em] text-slate-400">
                <tr>
                  {["#", "Caption", "Platform", "Account", "Status", "Scheduled / Published", "Engagement"].map((heading) => (
                    <th key={heading} className="px-4 py-4 font-bold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaignPosts.map((post, index) => {
                  const platform = getPostPlatform(post);
                  return (
                    <tr key={post.id} className="hover:bg-orange-50/40">
                      <td className="px-4 py-4 font-bold text-slate-500">{index + 1}</td>
                      <td className="max-w-xs px-4 py-4">
                        <p className="truncate font-semibold text-slate-800" title={post.caption || ""}>{post.caption || "No caption"}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full px-3 py-1 text-xs font-bold capitalize text-white" style={{ backgroundColor: getPlatformColor(platform) }}>
                          {platform}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-500">@{post.account?.handle || "account"}</td>
                      <td className="px-4 py-4"><StatusBadge status={post.publish_status} /></td>
                      <td className="px-4 py-4 text-slate-600">{formatDate(post.published_at || post.scheduled_for)}</td>
                      <td className="px-4 py-4 text-slate-600">
                        {post.publish_status === "published"
                          ? `${formatNumber(post.analytics?.likes_count)} ❤ ${formatNumber(post.analytics?.comments_count)} 💬 ${formatNumber(post.analytics?.shares_count)} ↻`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid place-items-center px-6 py-14 text-center text-slate-500">
            <FileText className="h-12 w-12 text-slate-300" />
            <p className="mt-3 font-semibold">No posts are attached to this campaign yet.</p>
          </div>
        )}
      </section>

      <AddPostModal
        open={addOpen}
        posts={allPosts.filter((post) => Number(post.campaign_id) !== Number(id))}
        accounts={accounts}
        selectedAccount={selectedAccount}
        selectedPost={selectedPost}
        onAccountChange={setSelectedAccount}
        onPostChange={setSelectedPost}
        onCancel={() => setAddOpen(false)}
        onSubmit={addPostToCampaign}
        busy={busy}
      />
      <ConfirmModal
        open={deleteOpen}
        busy={busy}
        message={`Are you sure you want to delete ${campaign.name}? This cannot be undone.`}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={deleteCampaign}
      />
    </main>
  );
}
