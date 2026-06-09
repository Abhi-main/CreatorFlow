import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarPlus, Facebook, Instagram, Linkedin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { accountsApi, analyticsApi } from "../api/services";
import { useAuth } from "../context/AuthContext";
import { useSocketEvent } from "../hooks/useSocket";
import { socket } from "../socket/socket";
import { EVENTS } from "../socket/events";
import EmptyState from "../components/shared/EmptyState";
import LoadingSpinner from "../components/shared/LoadingSpinner";
import PostCard from "../components/shared/PostCard";
import StatCard from "../components/shared/StatCard";
import { PageCard } from "../components/shared/Ui";
import LiveActivityFeed from "../components/LiveActivityFeed";
import ContentIdeasGenerator from "../components/ai/ContentIdeasGenerator";

const ACCOUNT_KEY = "smart-social-dashboard-account";

function toArray(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  return payload?.items || payload?.data || [];
}

function settledValue(result, fallback) {
  return result.status === "fulfilled" ? result.value : fallback;
}

function platformIcon(slug) {
  if (slug === "facebook") {
    return <Facebook className="h-5 w-5" />;
  }

  if (slug === "linkedin") {
    return <Linkedin className="h-5 w-5" />;
  }

  return <Instagram className="h-5 w-5" />;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState(localStorage.getItem(ACCOUNT_KEY) || "");
  const [followers, setFollowers] = useState([]);
  const [daily, setDaily] = useState([]);
  const [isLive, setIsLive] = useState(socket.connected);
  const [followerFlash, setFollowerFlash] = useState(false);

  const normalizeDashboard = useCallback((dashboardPayload) => ({
    summary: {
      totalPosts: 0,
      totalReach: 0,
      avgEngagementRate: 0,
      followers: 0,
      ...(dashboardPayload?.summary || {})
    },
    accounts: toArray(dashboardPayload?.accounts || []),
    upcomingPosts: dashboardPayload?.upcomingPosts || dashboardPayload?.upcoming_posts || [],
    recentNotifications: dashboardPayload?.recentNotifications || dashboardPayload?.recent_notifications || []
  }), []);

  const refreshDashboard = useCallback(async () => {
    const dashboardPayload = await analyticsApi.dashboard();
    setDashboard(normalizeDashboard(dashboardPayload));
  }, [normalizeDashboard]);

  const refreshAccountCharts = useCallback(async (selectedAccountId) => {
    if (!selectedAccountId) {
      return;
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 29);

    const results = await Promise.allSettled([
      analyticsApi.followers(selectedAccountId),
      analyticsApi.daily(selectedAccountId)
    ]);

    const [followerResult, dailyResult] = results;

    setFollowers(toArray(settledValue(followerResult, [])).slice(-30));
    setDaily(toArray(settledValue(dailyResult, [])).slice(-7));

    if (results.every((result) => result.status === "rejected")) {
      throw followerResult.reason || new Error("Unable to refresh dashboard charts.");
    }
  }, []);

  useEffect(() => {
    document.title = "Dashboard | Smart Social";
  }, []);

  useEffect(() => {
    const handleConnect = () => setIsLive(true);
    const handleDisconnect = () => setIsLive(false);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    setIsLive(socket.connected);
    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, []);

  useSocketEvent(
    EVENTS.ANALYTICS_UPDATED,
    useCallback((data) => {
      if (String(data.accountId) !== String(accountId)) return;
      setDaily((current) => {
        const today = new Date().toISOString().slice(0, 10);
        const updated = [...current];
        const index = updated.findIndex((item) => String(item.stat_date || item.analytics_date).slice(0, 10) === today);
        if (index >= 0) {
          updated[index] = { ...updated[index], ...data.daily };
        }
        return updated;
      });
    }, [accountId])
  );

  useSocketEvent(
    EVENTS.FOLLOWERS_UPDATED,
    useCallback((data) => {
      if (String(data.accountId) !== String(accountId)) return;
      setDashboard((current) =>
        current
          ? {
              ...current,
              accounts: (current.accounts || []).map((account) =>
                String(account.account_id || account.id) === String(data.accountId)
                  ? {
                      ...account,
                      follower_count: data.followerCount,
                      social_follower_count: data.followerCount
                    }
                  : account
              ),
              summary: {
                ...(current.summary || {}),
                followers: data.followerCount,
                followerCount: data.followerCount
              }
            }
          : current
      );
      setFollowers((current) => [
        ...current,
        {
          captured_at: new Date().toISOString(),
          recorded_date: new Date().toISOString().slice(0, 10),
          follower_count: data.followerCount,
          net_change: data.change
        }
      ].slice(-30));
      setFollowerFlash(true);
      window.setTimeout(() => setFollowerFlash(false), 2000);
    }, [accountId])
  );

  useSocketEvent(
    EVENTS.POST_PUBLISHED,
    useCallback(() => {
      toast.success("A post just went live.");
      refreshDashboard().catch(() => {});
      refreshAccountCharts(accountId).catch(() => {});
    }, [accountId, refreshAccountCharts, refreshDashboard])
  );

  useSocketEvent(
    EVENTS.POST_FAILED,
    useCallback((data) => {
      toast.error(`Post #${data.postId} failed to publish`);
    }, [])
  );

  useEffect(() => {
    Promise.allSettled([analyticsApi.dashboard(), accountsApi.list()])
      .then(([dashboardResult, accountsResult]) => {
        const dashboardPayload = settledValue(dashboardResult, null);
        const accountsPayload = settledValue(accountsResult, []);
        const accountItems = toArray(accountsPayload);
        setDashboard(normalizeDashboard(dashboardPayload));
        setAccounts(accountItems);

        const remembered = localStorage.getItem(ACCOUNT_KEY);
        const rememberedExists = accountItems.some(
          (account) => String(account.id || account.account_id) === String(remembered || "")
        );
        const fallbackAccountId = rememberedExists
          ? String(remembered)
          : String(accountItems[0]?.id || accountItems[0]?.account_id || "");
        setAccountId(fallbackAccountId);

        if (dashboardResult.status === "rejected" && accountsResult.status === "rejected") {
          throw dashboardResult.reason || accountsResult.reason || new Error("Unable to load dashboard.");
        }
      })
      .catch(() => {
        toast.error("Unable to load dashboard.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [normalizeDashboard]);

  useEffect(() => {
    if (!accounts.length || !accountId) {
      return;
    }

    const selectedExists = accounts.some(
      (account) => String(account.id || account.account_id) === String(accountId)
    );

    if (!selectedExists) {
      const fallback = String(accounts[0]?.id || accounts[0]?.account_id || "");
      if (fallback && fallback !== accountId) {
        setAccountId(fallback);
      }
      return;
    }

    localStorage.setItem(ACCOUNT_KEY, accountId);
    refreshAccountCharts(accountId)
      .catch(() => {
        toast.error("Unable to refresh dashboard charts.");
      });
  }, [accountId, accounts, refreshAccountCharts]);

  const followerChange = useMemo(() => {
    if (followers.length < 2) {
      return "+0%";
    }

    const first = Number(followers[0].follower_count || 0);
    const last = Number(followers[followers.length - 1].follower_count || 0);
    const diff = first ? ((last - first) / first) * 100 : 0;
    return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`;
  }, [followers]);

  const selectedAccountSummary = useMemo(() => {
    const selectedDashboardAccount = (dashboard?.accounts || []).find(
      (account) => String(account.account_id || account.id) === String(accountId)
    );
    const latestFollowerCount = followers.length
      ? Number(followers[followers.length - 1]?.follower_count || 0)
      : Number(
          selectedDashboardAccount?.follower_count ||
            selectedDashboardAccount?.social_follower_count ||
            dashboard?.summary?.followers ||
            dashboard?.summary?.followerCount ||
            0
        );

    return {
      totalPosts: Number(selectedDashboardAccount?.total_posts || 0),
      totalReach: Number(selectedDashboardAccount?.total_reach || selectedDashboardAccount?.total_impressions || 0),
      avgEngagementRate: Number(selectedDashboardAccount?.avg_engagement_rate || 0),
      followers: latestFollowerCount,
      followerCount: latestFollowerCount
    };
  }, [accountId, dashboard?.accounts, dashboard?.summary?.followerCount, dashboard?.summary?.followers, followers]);

  const engagementMix = useMemo(
    () =>
      daily.map((item) => {
        const engagementCount = Number(
          item.engagement_count ??
            (Number(item.total_likes || item.likes || 0) + Number(item.total_comments || item.comments || 0) + Number(item.total_shares || item.shares || 0))
        );
        const likes = Math.round(engagementCount * 0.58);
        const comments = Math.round(engagementCount * 0.26);
        const shares = Math.max(0, engagementCount - likes - comments);
        const dateValue = item.analytics_date || item.stat_date || item.created_at;

        return {
          day: dateValue ? new Date(dateValue).toLocaleDateString("en-US", { weekday: "short", timeZone: user?.timezone }) : "",
          likes,
          comments,
          shares
        };
      }),
    [daily, user?.timezone]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="app-surface animate-pulse p-6">
              <div className="h-4 w-24 rounded bg-slate-100" />
              <div className="mt-4 h-10 w-28 rounded bg-slate-100" />
            </div>
          ))}
        </div>
        <div className="app-surface animate-pulse p-8">
          <div className="h-64 rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return <LoadingSpinner label="Loading dashboard..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-slate-500">Welcome back, {user?.full_name}. Here's how your content engine is performing today.</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isLive ? "bg-brand-green animate-pulse" : "bg-slate-300"}`} />
            <span className="text-xs font-semibold text-slate-500">{isLive ? "Live" : "Offline"}</span>
          </div>
        </div>
        <select className="app-input max-w-xs" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
          {accounts.map((account) => (
            <option key={account.id || account.account_id} value={account.id || account.account_id}>
              {account.platform?.name} - {account.account_name}
            </option>
          ))}
        </select>
      </div>

      <section className="grid gap-4 xl:grid-cols-4">
        <StatCard title="Total Posts" value={selectedAccountSummary.totalPosts || 0} change="+0.0%" icon={CalendarPlus} color="orange" />
        <StatCard title="Total Reach" value={Number(selectedAccountSummary.totalReach || 0).toLocaleString()} change="+0.0%" icon={Instagram} color="purple" />
        <StatCard title="Avg Engagement Rate" value={`${selectedAccountSummary.avgEngagementRate || 0}%`} change="+0.0%" icon={Facebook} color="green" />
        <div className={followerFlash ? "rounded-2xl ring-4 ring-emerald-200 transition" : ""}>
          <StatCard title="Follower Count" value={Number(selectedAccountSummary.followers || selectedAccountSummary.followerCount || 0).toLocaleString()} change={followerChange} icon={Linkedin} color="blue" />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <PageCard title="Follower Growth - Last 30 Days">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={followers}>
                <defs>
                  <linearGradient id="followersGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#F5A623" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#F5A623" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="4 4" />
                <XAxis dataKey="captured_at" tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: user?.timezone })} stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Line type="monotone" dataKey="follower_count" stroke="#F5A623" strokeWidth={3} dot={false} fill="url(#followersGradient)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </PageCard>

        <PageCard title="Engagement - Last 7 Days">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={engagementMix}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="4 4" />
                <XAxis dataKey="day" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Legend verticalAlign="bottom" />
                <Bar dataKey="likes" fill="#F5A623" radius={[6, 6, 0, 0]} />
                <Bar dataKey="comments" fill="#7C4DFF" radius={[6, 6, 0, 0]} />
                <Bar dataKey="shares" fill="#00C896" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PageCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <PageCard
          title="Upcoming Scheduled Posts"
          actions={
            <button type="button" className="text-sm font-semibold text-brand-purple">
              View All
            </button>
          }
        >
          {(dashboard.upcomingPosts || []).length ? (
            <div className="space-y-3">
              {(dashboard.upcomingPosts || []).map((post) => (
                <PostCard
                  key={post.id || post.post_id}
                  platformLabel={post.account?.account_name || post.title}
                  caption={post.caption}
                  scheduledAt={new Intl.DateTimeFormat("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: user?.timezone
                  }).format(new Date(post.scheduled_for || post.scheduled_at))}
                  icon={platformIcon(post.account?.platform?.slug)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No scheduled posts"
              description="Create your first scheduled post to start filling the content calendar."
              action={<button type="button" className="app-button-primary">Schedule Post</button>}
            />
          )}
        </PageCard>

        <PageCard title="Recent Notifications">
          {(dashboard.recentNotifications || []).length ? (
            <div className="space-y-3">
              {(dashboard.recentNotifications || []).map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-orange-200 hover:bg-orange-50/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{notification.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{notification.body}</p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="All clear" description="New publishing alerts and sync updates will show up here." />
          )}
        </PageCard>
      </section>

      <PageCard title="Live Activity">
        <LiveActivityFeed />
      </PageCard>

      <ContentIdeasGenerator accountId={accountId} teamId={user?.team_id} />
    </div>
  );
}
