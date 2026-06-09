import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { BarChart2, CalendarRange, Download } from "lucide-react";
import DatePicker from "react-datepicker";
import toast from "react-hot-toast";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { accountsApi, adminApi, analyticsApi } from "../api/services";
import PostSentimentAnalysis from "../components/ai/PostSentimentAnalysis";
import EmptyState from "../components/shared/EmptyState";
import StatCard from "../components/shared/StatCard";
import { DataTable, PageCard } from "../components/shared/Ui";
import { useAuth } from "../context/AuthContext";
import { useSocketEvent } from "../hooks/useSocket";
import { EVENTS } from "../socket/events";

const ACCOUNT_KEY = "smart-social-analytics-account";
const presets = [7, 14, 30, 90, "custom"];
const platformColors = {
  instagram: "#FF4081",
  facebook: "#3B82F6",
  linkedin: "#06B6D4"
};

function startFromPreset(preset, customStart) {
  if (preset === "custom") {
    return customStart;
  }

  const date = new Date();
  date.setDate(date.getDate() - (Number(preset) - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function previousRange(start, end) {
  const currentStart = new Date(start);
  const currentEnd = endOfDay(end);
  const durationMs = currentEnd.getTime() - currentStart.getTime() + 1;
  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs + 1);
  return { previousStart, previousEnd };
}

function percentageChange(current, previous) {
  if (!previous) {
    return "+0.0%";
  }

  const diff = ((current - previous) / previous) * 100;
  return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`;
}

function formatDayKey(date, timezone) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: timezone
  }).format(date);
}

function metricValue(item, ...keys) {
  for (const key of keys) {
    if (item?.[key] !== undefined && item?.[key] !== null) {
      return Number(item[key] || 0);
    }
  }

  return 0;
}

function toArray(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  return payload?.items || payload?.data || [];
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(localStorage.getItem(ACCOUNT_KEY) || "");
  const [rangePreset, setRangePreset] = useState(30);
  const [customStart, setCustomStart] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    return date;
  });
  const [customEnd, setCustomEnd] = useState(new Date());
  const [daily, setDaily] = useState([]);
  const [comparisonDaily, setComparisonDaily] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [bestTimes, setBestTimes] = useState([]);
  const [posts, setPosts] = useState([]);
  const [comparisonPosts, setComparisonPosts] = useState([]);
  const [platformBreakdown, setPlatformBreakdown] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);

  const getActiveRange = useCallback(() => {
    const rangeStart = startFromPreset(rangePreset, customStart);
    const rangeEnd = rangePreset === "custom" ? customEnd : new Date();
    return { rangeStart, rangeEnd };
  }, [customEnd, customStart, rangePreset]);

  const refreshPlatformBreakdown = useCallback(async (accountItems, rangeStart, rangeEnd) => {
    const breakdownPayload = await Promise.all(
      accountItems.map(async (account) => ({
        account,
        posts: await analyticsApi.posts(account.id || account.account_id, {
          from: toDateOnly(rangeStart),
          to: toDateOnly(rangeEnd),
          limit: 200
        })
      }))
    );

    setPlatformBreakdown(
      breakdownPayload.map(({ account, posts: accountPosts }) => ({
        name: account.platform?.name || account.account_name,
        slug: account.platform?.slug || "instagram",
        value: toArray(accountPosts).reduce((sum, post) => sum + Number(post.analytics?.reach_count || 0), 0)
      }))
    );
  }, []);

  const refreshSelectedAccountAnalytics = useCallback(async () => {
    if (!selectedAccountId) {
      return;
    }

    const { rangeStart, rangeEnd } = getActiveRange();
    const { previousStart, previousEnd } = previousRange(rangeStart, rangeEnd);

    const [
      dailyPayload,
      previousDailyPayload,
      followerPayload,
      bestTimePayload,
      postPayload,
      previousPostPayload
    ] = await Promise.all([
      analyticsApi.daily(selectedAccountId, {
        startDate: toDateOnly(rangeStart),
        endDate: toDateOnly(rangeEnd)
      }),
      analyticsApi.daily(selectedAccountId, {
        startDate: toDateOnly(previousStart),
        endDate: toDateOnly(previousEnd)
      }),
      analyticsApi.followers(selectedAccountId, {
        startDate: toDateOnly(rangeStart),
        endDate: toDateOnly(rangeEnd)
      }),
      analyticsApi.bestTimes(selectedAccountId),
      analyticsApi.posts(selectedAccountId, {
        from: toDateOnly(rangeStart),
        to: toDateOnly(rangeEnd),
        limit: 200
      }),
      analyticsApi.posts(selectedAccountId, {
        from: toDateOnly(previousStart),
        to: toDateOnly(previousEnd),
        limit: 200
      })
    ]);

    setDaily(toArray(dailyPayload));
    setComparisonDaily(toArray(previousDailyPayload));
    setFollowers(toArray(followerPayload));
    setBestTimes(bestTimePayload?.slots || toArray(bestTimePayload));
    setPosts(toArray(postPayload));
    setComparisonPosts(toArray(previousPostPayload));
  }, [getActiveRange, selectedAccountId]);

  useEffect(() => {
    document.title = "Analytics | Smart Social";
  }, []);

  useSocketEvent(
    EVENTS.POST_PUBLISHED,
    useCallback(() => {
      const { rangeStart, rangeEnd } = getActiveRange();
      refreshSelectedAccountAnalytics().catch(() => {});
      refreshPlatformBreakdown(accounts, rangeStart, rangeEnd).catch(() => {});
    }, [accounts, getActiveRange, refreshPlatformBreakdown, refreshSelectedAccountAnalytics])
  );

  useEffect(() => {
    accountsApi
      .list()
      .then(async (payload) => {
        const accountItems = toArray(payload);
        setAccounts(accountItems);
        const remembered = localStorage.getItem(ACCOUNT_KEY);
        const fallback = remembered || String(accountItems[0]?.id || accountItems[0]?.account_id || "");
        setSelectedAccountId(fallback);
        const { rangeStart, rangeEnd } = getActiveRange();
        await refreshPlatformBreakdown(accountItems, rangeStart, rangeEnd);
      })
      .catch(() => {
        toast.error("Unable to load accounts.");
      });
  }, [getActiveRange, refreshPlatformBreakdown]);

  useEffect(() => {
    if (!selectedAccountId) {
      return;
    }

    localStorage.setItem(ACCOUNT_KEY, selectedAccountId);

    setLoading(true);
    refreshSelectedAccountAnalytics()
      .catch(() => {
        toast.error("Unable to load analytics.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [customEnd, customStart, rangePreset, refreshSelectedAccountAnalytics, selectedAccountId]);

  useEffect(() => {
    if (!accounts.length) {
      return;
    }

    const { rangeStart, rangeEnd } = getActiveRange();
    refreshPlatformBreakdown(accounts, rangeStart, rangeEnd).catch(() => {});
  }, [accounts, customEnd, customStart, getActiveRange, rangePreset, refreshPlatformBreakdown, selectedAccountId]);

  const stats = useMemo(() => {
    const totalReach = daily.reduce((sum, item) => sum + metricValue(item, "reach_count", "total_reach", "reach"), 0);
    const previousReach = comparisonDaily.reduce((sum, item) => sum + metricValue(item, "reach_count", "total_reach", "reach"), 0);
    const totalImpressions = daily.reduce((sum, item) => sum + metricValue(item, "impressions", "total_impressions"), 0);
    const previousImpressions = comparisonDaily.reduce((sum, item) => sum + metricValue(item, "impressions", "total_impressions"), 0);
    const totalLikes = daily.reduce((sum, item) => sum + metricValue(item, "likes", "total_likes"), 0);
    const previousLikes = comparisonDaily.reduce((sum, item) => sum + metricValue(item, "likes", "total_likes"), 0);
    const totalComments = daily.reduce((sum, item) => sum + metricValue(item, "comments", "total_comments"), 0);
    const previousComments = comparisonDaily.reduce((sum, item) => sum + metricValue(item, "comments", "total_comments"), 0);
    const totalShares = daily.reduce((sum, item) => sum + metricValue(item, "shares", "total_shares"), 0);
    const previousShares = comparisonDaily.reduce((sum, item) => sum + metricValue(item, "shares", "total_shares"), 0);
    const averageEngagementRate = daily.length
      ? daily.reduce((sum, item) => sum + metricValue(item, "engagement_rate", "avg_engagement_rate"), 0) / daily.length
      : posts.length
        ? posts.reduce((sum, post) => sum + Number(post.analytics?.engagement_rate || 0), 0) / posts.length
        : 0;
    const previousEngagementRate = comparisonDaily.length
      ? comparisonDaily.reduce((sum, item) => sum + metricValue(item, "engagement_rate", "avg_engagement_rate"), 0) / comparisonDaily.length
      : comparisonPosts.length
        ? comparisonPosts.reduce((sum, post) => sum + Number(post.analytics?.engagement_rate || 0), 0) / comparisonPosts.length
        : 0;

    return [
      { title: "Total Reach", value: totalReach.toLocaleString(), change: percentageChange(totalReach, previousReach), color: "orange" },
      { title: "Total Impressions", value: totalImpressions.toLocaleString(), change: percentageChange(totalImpressions, previousImpressions), color: "purple" },
      { title: "Total Likes", value: totalLikes.toLocaleString(), change: percentageChange(totalLikes, previousLikes), color: "green" },
      { title: "Total Comments", value: totalComments.toLocaleString(), change: percentageChange(totalComments, previousComments), color: "blue" },
      { title: "Total Shares", value: totalShares.toLocaleString(), change: percentageChange(totalShares, previousShares), color: "orange" },
      { title: "Avg Engagement Rate", value: `${averageEngagementRate.toFixed(2)}%`, change: percentageChange(averageEngagementRate, previousEngagementRate), color: "purple" }
    ];
  }, [comparisonDaily, comparisonPosts, daily, posts]);

  const engagementOverTime = useMemo(() => {
    return daily.map((item) => ({
      day: formatDayKey(new Date(item.analytics_date || item.stat_date), user?.timezone),
      likes: metricValue(item, "likes", "total_likes"),
      comments: metricValue(item, "comments", "total_comments"),
      shares: metricValue(item, "shares", "total_shares"),
      reach: metricValue(item, "reach_count", "total_reach", "reach")
    }));
  }, [daily, user?.timezone]);

  const heatmapCells = useMemo(() => {
    const slotsByDay = bestTimes.reduce((acc, item) => {
      const key = item.day_of_week;
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});

    return Array.from({ length: 7 }, (_, rowIndex) => {
      const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      const day = weekdays[rowIndex];
      const records = slotsByDay[day] || [];

      return {
        day,
        values: Array.from({ length: 24 }, (_, hour) => {
          const slot = records.find((item) => Number(item.best_hour) === hour);
          return slot ? Number(slot.engagement_score || 0) : 0;
        })
      };
    });
  }, [bestTimes]);

  const topPosts = useMemo(
    () => [...posts].sort((left, right) => Number(right.analytics?.engagement_rate || 0) - Number(left.analytics?.engagement_rate || 0)).slice(0, 5),
    [posts]
  );

  async function exportReport() {
    try {
      await adminApi.createReport({
        report_type: "analytics",
        report_name: "Smart Social Analytics Export",
        format: "pdf"
      });
      toast.success("Report export requested.");
    } catch {
      toast.error("Unable to export report.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="app-surface p-4 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid gap-3 md:grid-cols-[240px_auto]">
            <select className="app-input" value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)}>
              {accounts.map((account) => (
                <option key={account.id || account.account_id} value={account.id || account.account_id}>
                  {account.platform?.name} - {account.account_name}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setRangePreset(preset)}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold ${rangePreset === preset ? "bg-brand-purple text-white" : "border border-slate-200 bg-white text-slate-600"}`}
                >
                  {preset === "custom" ? "Custom" : `Last ${preset}`}
                </button>
              ))}
            </div>
          </div>

          <button type="button" onClick={exportReport} className="app-button-primary">
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </button>
        </div>

        {rangePreset === "custom" ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <DatePicker selected={customStart} onChange={(value) => setCustomStart(value || new Date())} className="app-input" />
            <DatePicker selected={customEnd} onChange={(value) => setCustomEnd(value || new Date())} className="app-input" />
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="app-surface animate-pulse p-5">
                <div className="h-4 w-20 rounded bg-slate-100" />
                <div className="mt-4 h-10 w-24 rounded bg-slate-100" />
              </div>
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="app-surface h-96 animate-pulse bg-slate-50" />
            <div className="app-surface h-96 animate-pulse bg-slate-50" />
          </div>
        </div>
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-6">
            {stats.map((item, index) => (
              <StatCard
                key={item.title}
                title={item.title}
                value={item.value}
                change={item.change}
                icon={[BarChart2, CalendarRange, Download, BarChart2, CalendarRange, Download][index]}
                color={item.color}
              />
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <PageCard title="Engagement Over Time">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={engagementOverTime}>
                    <CartesianGrid stroke="#f1f5f9" strokeDasharray="4 4" />
                    <XAxis dataKey="day" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip />
                    <Line type="monotone" dataKey="likes" stroke="#F5A623" strokeWidth={2} dot />
                    <Line type="monotone" dataKey="comments" stroke="#7C4DFF" strokeWidth={2} dot />
                    <Line type="monotone" dataKey="shares" stroke="#00C896" strokeWidth={2} dot />
                    <Line type="monotone" dataKey="reach" stroke="#3B82F6" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </PageCard>

            <PageCard title="Posting Heatmap">
              <div className="grid grid-cols-[72px_repeat(24,minmax(0,1fr))] gap-1 text-[11px]">
                <div />
                {Array.from({ length: 24 }, (_, hour) => (
                  <div key={hour} className="text-center text-slate-400">
                    {hour}
                  </div>
                ))}
                {heatmapCells.map((row) => (
                  <Fragment key={row.day}>
                    <div className="pr-2 text-sm font-medium text-slate-500">{row.day.slice(0, 3)}</div>
                    {row.values.map((value, hour) => (
                      <div
                        key={`${row.day}-${hour}`}
                        className="aspect-square rounded-md"
                        style={{
                          backgroundColor: value
                            ? `rgba(0, 200, 150, ${Math.max(0.18, value / 100)})`
                            : "rgba(226,232,240,0.55)"
                        }}
                        title={`${row.day} ${hour}:00`}
                      />
                    ))}
                  </Fragment>
                ))}
              </div>
            </PageCard>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <PageCard title="Follower Growth">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={followers}>
                    <defs>
                      <linearGradient id="followerArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7C4DFF" stopOpacity={0.24} />
                        <stop offset="95%" stopColor="#7C4DFF" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#f1f5f9" strokeDasharray="4 4" />
                    <XAxis dataKey="captured_at" tickFormatter={(value) => formatDayKey(new Date(value), user?.timezone)} stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip />
                    {followers[0] ? <ReferenceLine y={followers[0].follower_count} stroke="#c4b5fd" strokeDasharray="6 6" /> : null}
                    <Area type="monotone" dataKey="follower_count" stroke="#7C4DFF" fill="url(#followerArea)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </PageCard>

            <PageCard title="Platform Breakdown">
              {platformBreakdown.length ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={platformBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} innerRadius={70}>
                        {platformBreakdown.map((item) => (
                          <Cell key={item.slug} fill={platformColors[item.slug] || "#94a3b8"} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="chart-legend">
                    {platformBreakdown.map((item) => (
                      <div key={item.slug} className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: platformColors[item.slug] || "#94a3b8" }} />
                        {item.name}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState title="No platform data" description="Connect additional accounts to compare performance by platform." />
              )}
            </PageCard>
          </section>

          <PageCard title="Top Posts Table">
            {topPosts.length ? (
              <DataTable
                columns={[
                  { key: "rank", label: "#", render: (_row, index) => index + 1 },
                  { key: "thumbnail", label: "Thumbnail", render: () => <div className="h-12 w-12 rounded-xl bg-slate-100" /> },
                  { key: "caption", label: "Caption", render: (row) => <span className="block max-w-md truncate">{row.caption}</span> },
                  { key: "platform", label: "Platform", render: (row) => row.account?.platform?.name || "-" },
                  { key: "likes", label: "Likes", render: (row) => row.analytics?.likes_count || 0 },
                  { key: "comments", label: "Comments", render: (row) => row.analytics?.comments_count || 0 },
                  { key: "shares", label: "Shares", render: (row) => row.analytics?.shares_count || 0 },
                  { key: "reach", label: "Reach", render: (row) => row.analytics?.reach_count || 0 },
                  { key: "rate", label: "Eng. Rate", render: (row) => `${row.analytics?.engagement_rate || 0}%` }
                ]}
                rows={topPosts}
                onRowClick={setSelectedPost}
              />
            ) : (
              <EmptyState title="No top posts yet" description="Once posts collect engagement data, your top performers will show up here." />
            )}
          </PageCard>
        </>
      )}

      {selectedPost ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="app-surface w-full max-w-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Post details</h3>
                <p className="mt-2 text-sm text-slate-500">{selectedPost.account?.account_name}</p>
              </div>
              <button type="button" onClick={() => setSelectedPost(null)} className="app-button-secondary py-2">
                Close
              </button>
            </div>
            <div className="mt-5 space-y-4">
              <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">{selectedPost.caption}</p>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl bg-orange-50 p-4 text-sm text-slate-700">Likes: {selectedPost.analytics?.likes_count || 0}</div>
                <div className="rounded-2xl bg-violet-50 p-4 text-sm text-slate-700">Comments: {selectedPost.analytics?.comments_count || 0}</div>
                <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-slate-700">Shares: {selectedPost.analytics?.shares_count || 0}</div>
                <div className="rounded-2xl bg-blue-50 p-4 text-sm text-slate-700">Reach: {selectedPost.analytics?.reach_count || 0}</div>
              </div>
              <PostSentimentAnalysis postId={selectedPost.post_id || selectedPost.id} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
