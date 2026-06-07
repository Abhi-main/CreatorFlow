import { useCallback, useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import toast from "react-hot-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  BarChart2,
  Calendar,
  CheckCircle,
  Clock,
  Copy,
  FileImage,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  XCircle,
  Zap
} from "lucide-react";
import ConfirmModal from "../components/shared/ConfirmModal";
import { StatCard } from "../components/shared/Ui";
import { postsApi } from "../api/services";
import { useAuth } from "../context/AuthContext";
import { useSocketEvent } from "../hooks/useSocket";
import { EVENTS } from "../socket/events";
import { formatDate, formatNumber, formatRelative, getPlatformColor, getStatusColor } from "../utils/formatters";

const statuses = ["all", "draft", "scheduled", "published", "failed", "cancelled"];
const platforms = ["all", "instagram", "facebook", "linkedin"];

function toItems(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.items || [];
}

function getPostPlatform(post) {
  return String(post?.account?.platform?.slug || post?.account?.platform?.name || "instagram").toLowerCase();
}

function getPostDate(post) {
  return post.published_at || post.scheduled_for || post.updated_at || post.created_at;
}

function getPostId(post) {
  return post?.id || post?.post_id;
}

function upsertParam(searchParams, key, value) {
  const next = new URLSearchParams(searchParams);
  if (!value || value === "all") {
    next.delete(key);
  } else {
    next.set(key, value);
  }
  if (key !== "page") next.set("page", "1");
  return next;
}

function StatusPill({ status }) {
  const normalized = String(status || "draft").toLowerCase();
  const Icon = normalized === "published" ? CheckCircle : normalized === "scheduled" ? Clock : normalized === "failed" ? XCircle : null;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold capitalize ${getStatusColor(normalized)}`}>
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {normalized}
    </span>
  );
}

function PlatformBadge({ platform }) {
  const label = String(platform || "Instagram");
  return (
    <span
      className="inline-flex rounded-full px-3 py-1 text-xs font-bold capitalize text-white"
      style={{ backgroundColor: getPlatformColor(label) }}
    >
      {label}
    </span>
  );
}

function Pagination({ page, limit, total, onPageChange, onLimitChange }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = total ? (page - 1) * limit + 1 : 0;
  const end = Math.min(total, page * limit);
  const first = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => first + index).filter((item) => item <= totalPages);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
      <p>
        Showing {start}-{end} of {total} posts
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select className="app-input w-24 py-2" value={limit} onChange={(event) => onLimitChange(Number(event.target.value))}>
          {[10, 20, 50].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <button type="button" className="app-button-secondary py-2" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Prev
        </button>
        {pages.map((item) => (
          <button
            key={item}
            type="button"
            className={`h-10 w-10 rounded-2xl font-bold transition ${item === page ? "bg-brand-orange text-white" : "bg-white text-slate-600 hover:bg-orange-50"}`}
            onClick={() => onPageChange(item)}
          >
            {item}
          </button>
        ))}
        <button type="button" className="app-button-secondary py-2" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

function PostsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-2xl bg-white/80" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-2xl bg-white/80" />
    </div>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div className="grid place-items-center px-6 py-16 text-center">
      <div className="grid h-24 w-24 place-items-center rounded-[2rem] bg-gradient-to-br from-orange-100 to-violet-100 text-brand-purple">
        <Calendar className="h-12 w-12" />
      </div>
      <h3 className="mt-5 text-xl font-bold text-slate-950">No posts found</h3>
      <p className="mt-2 text-sm text-slate-500">Try adjusting your filters or create your first post.</p>
      <button type="button" className="app-button-primary mt-6 gap-2" onClick={onCreate}>
        <Plus className="h-4 w-4" />
        Create Post
      </button>
    </div>
  );
}

function PostDrawer({ post, onClose, onEdit, onDelete }) {
  if (!post) return null;

  const analytics = post.analytics || {};

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/30 backdrop-blur-sm" onClick={onClose}>
      <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Post detail</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">{post.title || "Untitled post"}</h2>
          </div>
          <button type="button" className="rounded-full p-2 text-slate-500 hover:bg-slate-100" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Platform</p>
            <div className="mt-2">
              <PlatformBadge platform={getPostPlatform(post)} />
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Status</p>
            <div className="mt-2">
              <StatusPill status={post.publish_status} />
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Caption</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{post.caption || "No caption provided."}</p>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Media</p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="grid aspect-square place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <FileImage className="h-7 w-7" />
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
          <p>
            <span className="font-bold text-slate-900">Account:</span> @{post.account?.handle || "account"}
          </p>
          <p>
            <span className="font-bold text-slate-900">Scheduled:</span> {formatDate(post.scheduled_for)}
          </p>
          <p>
            <span className="font-bold text-slate-900">Published:</span> {formatDate(post.published_at)}
          </p>
        </div>

        {post.publish_status === "published" ? (
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              ["Likes", analytics.likes_count],
              ["Comments", analytics.comments_count],
              ["Shares", analytics.shares_count],
              ["Reach", analytics.reach_count],
              ["Impressions", analytics.impressions],
              ["Eng. rate", `${analytics.engagement_rate || 0}%`]
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-gradient-to-br from-orange-50 to-violet-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
                <p className="mt-2 text-xl font-bold text-slate-950">{typeof value === "number" ? formatNumber(value) : value}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="sticky bottom-0 mt-8 flex gap-3 bg-white py-4">
          <button type="button" className="app-button-primary flex-1 gap-2" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            Edit Post
          </button>
          <button type="button" className="app-button-secondary flex-1 gap-2 text-rose-600" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            Delete Post
          </button>
        </div>
      </aside>
    </div>
  );
}

export default function PostHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchDraft, setSearchDraft] = useState(searchParams.get("search") || "");

  const status = searchParams.get("status") || "all";
  const platform = searchParams.get("platform") || "all";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const page = Number(searchParams.get("page") || 1);
  const limit = Number(searchParams.get("limit") || 20);
  const search = searchParams.get("search") || "";

  useEffect(() => {
    document.title = "Post History | Smart Social";
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchParams(upsertParam(searchParams, "search", searchDraft.trim()));
    }, 400);

    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  useEffect(() => {
    let alive = true;

    async function loadPosts() {
      setLoading(true);
      try {
        const payload = await postsApi.list({ page: 1, pageSize: 500 });
        if (alive) setPosts(toItems(payload));
      } catch (error) {
        toast.error(error?.response?.data?.message || "Unable to load posts.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadPosts();
    return () => {
      alive = false;
    };
  }, []);

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const postStatus = String(post.publish_status || "").toLowerCase();
      const postPlatform = getPostPlatform(post);
      const postDate = getPostDate(post);
      const caption = String(post.caption || "").toLowerCase();

      if (status !== "all" && postStatus !== status) return false;
      if (platform !== "all" && !postPlatform.includes(platform)) return false;
      if (search && !caption.includes(search.toLowerCase())) return false;
      if (from && (!postDate || new Date(postDate) < new Date(from))) return false;
      if (to && (!postDate || new Date(postDate) > new Date(`${to}T23:59:59`))) return false;
      return true;
    });
  }, [posts, status, platform, search, from, to]);

  const stats = useMemo(() => {
    const total = filteredPosts.length;
    const count = (target) => filteredPosts.filter((post) => post.publish_status === target).length;
    return {
      total,
      published: count("published"),
      scheduled: count("scheduled"),
      failed: count("failed")
    };
  }, [filteredPosts]);

  const visiblePosts = useMemo(() => filteredPosts.slice((page - 1) * limit, page * limit), [filteredPosts, page, limit]);
  const hasFilters = Boolean(search || status !== "all" || platform !== "all" || from || to);

  function setParam(key, value) {
    setSearchParams(upsertParam(searchParams, key, value));
  }

  function clearFilters() {
    setSearchDraft("");
    setSearchParams(new URLSearchParams({ page: "1", limit: String(limit) }));
  }

  async function refreshPosts() {
    const payload = await postsApi.list({ page: 1, pageSize: 500 });
    setPosts(toItems(payload));
  }

  useSocketEvent(
    EVENTS.POST_CREATED,
    useCallback((data) => {
      if (!data?.post) return;
      const createdBy = data.createdBy || data.created_by;
      if (String(createdBy) !== String(user?.user_id || user?.id)) {
        toast("A teammate created a new post.", { icon: "New" });
      }
      setPosts((current) => {
        const nextId = getPostId(data.post);
        if (current.some((post) => String(getPostId(post)) === String(nextId))) return current;
        return [data.post, ...current];
      });
    }, [user?.user_id, user?.id])
  );

  useSocketEvent(
    EVENTS.POST_UPDATED,
    useCallback((data) => {
      const postId = data?.postId || data?.post_id;
      if (!postId) return;
      setPosts((current) =>
        current.map((post) => (String(getPostId(post)) === String(postId) ? { ...post, ...(data.changes || {}) } : post))
      );
    }, [])
  );

  useSocketEvent(
    EVENTS.POST_PUBLISHED,
    useCallback((data) => {
      const postId = data?.postId || data?.post_id;
      if (!postId) return;
      setPosts((current) =>
        current.map((post) =>
          String(getPostId(post)) === String(postId)
            ? {
                ...post,
                publish_status: "published",
                status: "published",
                published_at: data.publishedAt || data.published_at || new Date().toISOString(),
                analytics: data.analytics || post.analytics
              }
            : post
        )
      );
    }, [])
  );

  useSocketEvent(
    EVENTS.POST_DELETED,
    useCallback((data) => {
      const postId = data?.postId || data?.post_id;
      if (!postId) return;
      setPosts((current) => current.filter((post) => String(getPostId(post)) !== String(postId)));
      if (String(data.deletedBy || data.deleted_by) !== String(user?.user_id || user?.id)) {
        toast("A post was deleted by a teammate.", { icon: "Deleted" });
      }
    }, [user?.user_id, user?.id])
  );

  async function handleDuplicate(post) {
    setBusy(true);
    try {
      await postsApi.create({
        title: `Copy of ${post.title || "Post"}`,
        caption: post.caption,
        social_account_id: post.social_account_id,
        campaign_id: post.campaign_id,
        publish_status: "draft"
      });
      await refreshPosts();
      toast.success("Post duplicated.", { duration: 3000 });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to duplicate post.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePublishNow(post) {
    setBusy(true);
    try {
      await postsApi.publishNow(getPostId(post));
      await refreshPosts();
      toast.success("Post published.", { duration: 3000 });
    } catch (error) {
      toast.error(
        error?.response?.data?.error
          || error?.response?.data?.message
          || "Unable to publish post."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await postsApi.remove(getPostId(deleteTarget));
      setPosts((current) => current.filter((post) => String(getPostId(post)) !== String(getPostId(deleteTarget))));
      if (String(getPostId(selectedPost)) === String(getPostId(deleteTarget))) setSelectedPost(null);
      setDeleteTarget(null);
      toast.success("Post deleted.", { duration: 3000 });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to delete post.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-100 text-brand-orange">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500">Smart Social</p>
            <h1 className="text-3xl font-bold text-slate-950">Post History</h1>
          </div>
        </div>
        <button type="button" className="app-button-primary gap-2" onClick={() => navigate("/schedule")}>
          <Plus className="h-4 w-4" />
          Create Post
        </button>
      </div>

      <section className="app-surface flex flex-col gap-4 p-5">
        <div className="grid gap-3 lg:grid-cols-[1.3fr_2fr_1.5fr]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="app-input pl-11"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search captions..."
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {statuses.map((item) => (
              <button
                key={item}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-bold capitalize transition ${
                  status === item ? "bg-brand-orange text-white shadow-soft" : "bg-slate-50 text-slate-600 hover:bg-orange-50"
                }`}
                onClick={() => setParam("status", item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {platforms.map((item) => (
              <button
                key={item}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-bold capitalize transition ${
                  platform === item ? "text-white shadow-soft" : "bg-slate-50 text-slate-600 hover:bg-violet-50"
                }`}
                style={platform === item && item !== "all" ? { backgroundColor: getPlatformColor(item) } : platform === item ? { backgroundColor: "#7C4DFF" } : undefined}
                onClick={() => setParam("platform", item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DatePicker
            selected={from ? new Date(from) : null}
            onChange={(date) => setParam("from", date ? date.toISOString().slice(0, 10) : "")}
            selectsStart
            startDate={from ? new Date(from) : null}
            endDate={to ? new Date(to) : null}
            placeholderText="From"
            className="app-input w-40"
          />
          <DatePicker
            selected={to ? new Date(to) : null}
            onChange={(date) => setParam("to", date ? date.toISOString().slice(0, 10) : "")}
            selectsEnd
            startDate={from ? new Date(from) : null}
            endDate={to ? new Date(to) : null}
            minDate={from ? new Date(from) : null}
            placeholderText="To"
            className="app-input w-40"
          />
          {hasFilters ? (
            <button type="button" className="font-bold text-brand-purple hover:text-brand-orange" onClick={clearFilters}>
              Clear Filters
            </button>
          ) : null}
        </div>
      </section>

      {loading ? (
        <PostsSkeleton />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Total Posts" value={formatNumber(stats.total)} change="Filtered result" icon={FileText} color="grey" />
            <StatCard title="Published" value={formatNumber(stats.published)} change={`${stats.published} live`} icon={CheckCircle} color="green" />
            <StatCard title="Scheduled" value={formatNumber(stats.scheduled)} change={`${stats.scheduled} queued`} icon={Clock} color="orange" />
            <StatCard title="Failed" value={formatNumber(stats.failed)} change={`${stats.failed} failed`} icon={XCircle} color="red" />
          </section>

          <section className="app-surface overflow-hidden">
            {visiblePosts.length ? (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.22em] text-slate-400">
                      <tr>
                        {["#", "Media", "Caption", "Platform", "Account", "Status", "Scheduled / Published", "Engagement", "Actions"].map((heading) => (
                          <th key={heading} className="px-4 py-4 font-bold">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visiblePosts.map((post, index) => {
                        const rowNumber = (page - 1) * limit + index + 1;
                        const analytics = post.analytics || {};
                        const statusValue = String(post.publish_status || "draft").toLowerCase();
                        const actionButton = "rounded-full p-2 text-slate-400 transition hover:bg-orange-50 hover:text-brand-orange";
                        const dateValue = statusValue === "published" ? post.published_at : post.scheduled_for;

                        return (
                          <tr key={getPostId(post)} className="group cursor-pointer bg-white hover:bg-orange-50/40" onClick={() => setSelectedPost(post)}>
                            <td className="px-4 py-4 font-bold text-slate-500">{rowNumber}</td>
                            <td className="px-4 py-4">
                              <div className="grid h-12 w-12 place-items-center rounded-lg bg-slate-100 text-slate-400">
                                <FileImage className="h-5 w-5" />
                              </div>
                            </td>
                            <td className="max-w-xs px-4 py-4">
                              <p className="truncate font-semibold text-slate-800" title={post.caption || ""}>
                                {post.caption?.length > 60 ? `${post.caption.slice(0, 60)}...` : post.caption || "No caption"}
                              </p>
                            </td>
                            <td className="px-4 py-4">
                              <PlatformBadge platform={getPostPlatform(post)} />
                            </td>
                            <td className="px-4 py-4 text-slate-500">@{post.account?.handle || "account"}</td>
                            <td className="px-4 py-4">
                              <StatusPill status={statusValue} />
                            </td>
                            <td className="px-4 py-4">
                              <p className="font-semibold text-slate-800">{formatDate(dateValue)}</p>
                              <p className="mt-1 text-xs text-slate-500">{dateValue ? formatRelative(dateValue) : "-"}</p>
                            </td>
                            <td className="px-4 py-4 text-slate-600">
                              {statusValue === "published" ? (
                                <span className="whitespace-nowrap">
                                  {formatNumber(analytics.likes_count)} ❤ {formatNumber(analytics.comments_count)} 💬 {formatNumber(analytics.shares_count)} ↻
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                                <button type="button" className={actionButton} title="Edit" onClick={(event) => { event.stopPropagation(); navigate(`/schedule?edit=${getPostId(post)}`); }}>
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button type="button" className={actionButton} title="Duplicate" disabled={busy} onClick={(event) => { event.stopPropagation(); handleDuplicate(post); }}>
                                  <Copy className="h-4 w-4" />
                                </button>
                                <button type="button" className={actionButton} title="Delete" disabled={busy} onClick={(event) => { event.stopPropagation(); setDeleteTarget(post); }}>
                                  <Trash2 className="h-4 w-4" />
                                </button>
                                {["draft", "scheduled"].includes(statusValue) ? (
                                  <button type="button" className={actionButton} title="Publish Now" disabled={busy} onClick={(event) => { event.stopPropagation(); handlePublishNow(post); }}>
                                    <Zap className="h-4 w-4" />
                                  </button>
                                ) : null}
                                {statusValue === "published" ? (
                                  <button type="button" className={actionButton} title="View Analytics" onClick={(event) => { event.stopPropagation(); navigate(`/analytics?postId=${getPostId(post)}`); }}>
                                    <BarChart2 className="h-4 w-4" />
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={page}
                  limit={limit}
                  total={filteredPosts.length}
                  onPageChange={(nextPage) => setParam("page", String(nextPage))}
                  onLimitChange={(nextLimit) => {
                    const next = new URLSearchParams(searchParams);
                    next.set("limit", String(nextLimit));
                    next.set("page", "1");
                    setSearchParams(next);
                  }}
                />
              </>
            ) : (
              <EmptyState onCreate={() => navigate("/schedule")} />
            )}
          </section>
        </>
      )}

      <PostDrawer
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
        onEdit={() => selectedPost && navigate(`/schedule?edit=${getPostId(selectedPost)}`)}
        onDelete={() => selectedPost && setDeleteTarget(selectedPost)}
      />
      <ConfirmModal
        open={Boolean(deleteTarget)}
        busy={busy}
        message={`Are you sure you want to delete ${deleteTarget?.title || "this post"}? This cannot be undone.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </main>
  );
}
