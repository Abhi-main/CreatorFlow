import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import {
  BarChart2,
  CalendarDays,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Filter,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
  Zap
} from "lucide-react";
import { format, parseISO } from "date-fns";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import ConfirmModal from "../components/shared/ConfirmModal";
import { useSocketEvent } from "../hooks/useSocket";
import { EVENTS } from "../socket/events";
import "../styles/calendar.css";

const PLATFORM_CONFIG = {
  Instagram: { color: "#E1306C", bg: "bg-pink-100", text: "text-pink-700" },
  Facebook: { color: "#1877F2", bg: "bg-blue-100", text: "text-blue-700" },
  LinkedIn: { color: "#0A66C2", bg: "bg-cyan-100", text: "text-cyan-700" }
};

const STATUS_CONFIG = {
  scheduled: { label: "Scheduled", icon: Clock, color: "text-orange-500", bg: "bg-orange-50" },
  published: { label: "Published", icon: CheckCircle, color: "text-green-500", bg: "bg-green-50" },
  draft: { label: "Draft", icon: FileText, color: "text-slate-500", bg: "bg-slate-50" },
  failed: { label: "Failed", icon: XCircle, color: "text-rose-500", bg: "bg-rose-50" }
};

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function normalizePlatform(account) {
  return account.platform || account.platform_name || account.platform?.name || account.name || "";
}

function mediaUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const root = (import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`).replace(/\/api\/?$/, "");
  return `${root}${url.startsWith("/") ? "" : "/"}${url}`;
}

function eventSnapshot(event) {
  return {
    id: event.id,
    title: event.title,
    start: event.startStr,
    backgroundColor: event.backgroundColor,
    extendedProps: { ...event.extendedProps }
  };
}

export default function Calendar() {
  const navigate = useNavigate();
  const calendarRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [unscheduledPosts, setUnscheduledPosts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentTitle, setCurrentTitle] = useState("");
  const [currentView, setCurrentView] = useState("dayGridMonth");
  const [showFilters, setShowFilters] = useState(false);
  const [showUnscheduled, setShowUnscheduled] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [range, setRange] = useState({ from: "", to: "" });
  const [filters, setFilters] = useState({ accountId: "", platform: "", status: "" });

  useEffect(() => {
    document.title = "Content Calendar | Smart Social";
    api
      .get("/accounts")
      .then((res) => setAccounts(normalizeList(res.data.data)))
      .catch(() => setAccounts([]));
  }, []);

  const fetchEvents = useCallback(async () => {
    if (!range.from || !range.to) return;
    setLoading(true);
    try {
      const params = {
        from: range.from,
        to: range.to,
        ...(filters.accountId ? { accountId: filters.accountId } : {}),
        ...(filters.platform ? { platform: filters.platform } : {})
      };
      const { data } = await api.get("/posts/calendar", { params });
      let calendarEvents = data.data || [];

      if (filters.status) {
        calendarEvents = calendarEvents.filter((event) => event.extendedProps?.status === filters.status);
      }

      setEvents(calendarEvents.filter((event) => event.start));
      setUnscheduledPosts(calendarEvents.filter((event) => !event.start));
    } catch {
      toast.error("Failed to load calendar events");
    } finally {
      setLoading(false);
    }
  }, [filters, range]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useSocketEvent(EVENTS.POST_CREATED, fetchEvents);
  useSocketEvent(EVENTS.POST_UPDATED, fetchEvents);
  useSocketEvent(EVENTS.POST_DELETED, fetchEvents);
  useSocketEvent(EVENTS.POST_PUBLISHED, fetchEvents);
  useSocketEvent(EVENTS.POST_SCHEDULED, fetchEvents);
  useSocketEvent(EVENTS.POST_RESCHEDULED, fetchEvents);

  const stats = useMemo(() => {
    const all = [...events, ...unscheduledPosts];
    return {
      scheduled: all.filter((event) => event.extendedProps?.status === "scheduled").length,
      published: all.filter((event) => event.extendedProps?.status === "published").length,
      draft: all.filter((event) => event.extendedProps?.status === "draft").length,
      failed: all.filter((event) => event.extendedProps?.status === "failed").length
    };
  }, [events, unscheduledPosts]);

  const goToday = () => calendarRef.current?.getApi().today();
  const goPrev = () => calendarRef.current?.getApi().prev();
  const goNext = () => calendarRef.current?.getApi().next();

  const changeView = (view) => {
    calendarRef.current?.getApi().changeView(view);
    setCurrentView(view);
  };

  const handleDateClick = (info) => {
    navigate(`/schedule?date=${encodeURIComponent(info.dateStr)}`);
  };

  const handleEventClick = (info) => {
    setSelectedEvent(eventSnapshot(info.event));
  };

  const handleEventDrop = async (info) => {
    const postId = info.event.extendedProps.post_id;
    const status = info.event.extendedProps.status;
    const newDate = info.event.startStr;

    if (status === "published") {
      toast.error("Published posts cannot be rescheduled");
      info.revert();
      return;
    }

    const toastId = toast.loading("Rescheduling post...");
    try {
      await api.patch(`/posts/${postId}/reschedule`, {
        scheduled_at: newDate,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      toast.success("Post rescheduled", { id: toastId });
      setSelectedEvent((current) =>
        current?.extendedProps?.post_id === postId
          ? {
              ...current,
              start: newDate,
              extendedProps: { ...current.extendedProps, status: "scheduled", scheduled_at: newDate }
            }
          : current
      );
      fetchEvents();
    } catch {
      toast.error("Failed to reschedule post", { id: toastId });
      info.revert();
    }
  };

  const handlePublishNow = async (postId) => {
    const toastId = toast.loading("Publishing post...");
    try {
      await api.post(`/posts/${postId}/publish-now`);
      toast.success("Post published", { id: toastId });
      setSelectedEvent(null);
      fetchEvents();
    } catch {
      toast.error("Failed to publish post", { id: toastId });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/posts/${deleteTarget.postId}`);
      setEvents((current) => current.filter((event) => String(event.extendedProps.post_id) !== String(deleteTarget.postId)));
      setUnscheduledPosts((current) => current.filter((event) => String(event.extendedProps.post_id) !== String(deleteTarget.postId)));
      setSelectedEvent(null);
      setDeleteTarget(null);
      toast.success("Post deleted");
    } catch {
      toast.error("Failed to delete post");
    } finally {
      setDeleting(false);
    }
  };

  const renderEventContent = (eventInfo) => {
    const { status, platform } = eventInfo.event.extendedProps;
    const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;
    const StatusIcon = statusCfg.icon;

    return (
      <div className="flex w-full items-center gap-1 overflow-hidden px-1.5 py-0.5">
        <StatusIcon className="h-3 w-3 shrink-0 opacity-90" />
        <span className="flex-1 truncate text-xs font-semibold">{eventInfo.event.title}</span>
        <span className="shrink-0 text-[10px] font-bold opacity-75">{platform?.slice(0, 2)}</span>
      </div>
    );
  };

  const selectedMedia = selectedEvent?.extendedProps?.media_urls?.[0];
  const selectedStatus = selectedEvent?.extendedProps?.status;
  const selectedStatusCfg = STATUS_CONFIG[selectedStatus] || STATUS_CONFIG.scheduled;
  const SelectedStatusIcon = selectedStatusCfg.icon;

  return (
    <div className="flex h-[calc(100vh-8.5rem)] gap-4 overflow-hidden">
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="app-surface mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button type="button" onClick={goPrev} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={goToday} className="rounded-xl bg-brand-orange px-3 py-2 text-sm font-bold text-white">
                Today
              </button>
              <button type="button" onClick={goNext} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-950">{currentTitle || "Content Calendar"}</h2>
              <p className="text-xs text-slate-400">Drag scheduled posts to change publish time</p>
            </div>
            {loading ? <RefreshCw className="h-4 w-4 animate-spin text-slate-400" /> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-2xl bg-slate-100 p-1">
              {[
                ["dayGridMonth", "Month"],
                ["timeGridWeek", "Week"],
                ["timeGridDay", "Day"],
                ["listWeek", "List"]
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => changeView(key)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    currentView === key ? "bg-white text-brand-orange shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((current) => !current)}
              className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-bold ${
                showFilters ? "border-orange-200 bg-orange-50 text-brand-orange" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Filter className="h-4 w-4" />
              Filters
              {filters.accountId || filters.platform || filters.status ? <span className="h-2 w-2 rounded-full bg-brand-orange" /> : null}
            </button>
            <button type="button" onClick={() => navigate("/schedule")} className="app-button-primary inline-flex items-center gap-2 py-2">
              <Plus className="h-4 w-4" />
              New Post
            </button>
          </div>
        </div>

        {showFilters ? (
          <div className="app-surface mb-4 flex flex-wrap items-center gap-3 px-4 py-3">
            <select
              value={filters.accountId}
              onChange={(event) => setFilters((current) => ({ ...current, accountId: event.target.value }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              <option value="">All Accounts</option>
              {accounts.map((account) => (
                <option key={account.account_id || account.id} value={account.account_id || account.id}>
                  {account.account_handle} ({normalizePlatform(account)})
                </option>
              ))}
            </select>
            <select
              value={filters.platform}
              onChange={(event) => setFilters((current) => ({ ...current, platform: event.target.value }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              <option value="">All Platforms</option>
              <option value="Instagram">Instagram</option>
              <option value="Facebook">Facebook</option>
              <option value="LinkedIn">LinkedIn</option>
            </select>
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              <option value="">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="failed">Failed</option>
            </select>
            {filters.accountId || filters.platform || filters.status ? (
              <button type="button" onClick={() => setFilters({ accountId: "", platform: "", status: "" })} className="text-sm font-bold text-rose-500">
                Clear All
              </button>
            ) : null}
            <div className="ml-auto flex flex-wrap items-center gap-3">
              {Object.entries(PLATFORM_CONFIG).map(([name, cfg]) => (
                <div key={name} className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: cfg.color }} />
                  <span className="text-xs font-semibold text-slate-500">{name}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="calendar-wrapper app-surface min-h-0 flex-1 overflow-hidden p-2">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView="dayGridMonth"
            headerToolbar={false}
            events={events}
            editable
            selectable
            selectMirror
            dayMaxEvents={4}
            nowIndicator
            weekends
            eventDrop={handleEventDrop}
            eventResize={handleEventDrop}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            eventContent={renderEventContent}
            datesSet={(dateInfo) => {
              setCurrentTitle(dateInfo.view.title);
              setCurrentView(dateInfo.view.type);
              setRange({ from: dateInfo.startStr, to: dateInfo.endStr });
            }}
            height="100%"
            eventTimeFormat={{ hour: "2-digit", minute: "2-digit", meridiem: "short" }}
            slotMinTime="06:00:00"
            slotMaxTime="23:00:00"
            allDaySlot={false}
            snapDuration="00:15:00"
          />
        </div>
      </section>

      <aside className="hidden w-80 shrink-0 flex-col gap-4 overflow-y-auto xl:flex">
        {selectedEvent ? (
          <div className="app-surface overflow-hidden">
            <div className="border-b border-slate-100 p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      PLATFORM_CONFIG[selectedEvent.extendedProps.platform]?.bg || "bg-slate-100"
                    } ${PLATFORM_CONFIG[selectedEvent.extendedProps.platform]?.text || "text-slate-600"}`}
                  >
                    {selectedEvent.extendedProps.platform}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${selectedStatusCfg.bg} ${selectedStatusCfg.color}`}>
                    <SelectedStatusIcon className="h-3 w-3" />
                    {selectedStatusCfg.label}
                  </span>
                </div>
                <button type="button" onClick={() => setSelectedEvent(null)} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100">
                  x
                </button>
              </div>
              <p className="text-xs font-semibold text-slate-400">@{selectedEvent.extendedProps.account_handle}</p>
            </div>

            {selectedMedia ? (
              <div className="aspect-video overflow-hidden bg-slate-100">
                <img src={mediaUrl(selectedMedia)} alt="Post media" className="h-full w-full object-cover" />
              </div>
            ) : null}

            <div className="p-4">
              <p className="mb-4 line-clamp-5 text-sm leading-6 text-slate-700">
                {selectedEvent.extendedProps.caption || <span className="text-slate-400">No caption yet.</span>}
              </p>
              <div className="mb-4 space-y-2">
                {selectedEvent.extendedProps.scheduled_at ? (
                  <p className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="h-3.5 w-3.5 text-brand-orange" />
                    Scheduled: {format(parseISO(selectedEvent.extendedProps.scheduled_at), "MMM d, yyyy - h:mm a")}
                  </p>
                ) : null}
                {selectedEvent.extendedProps.published_at ? (
                  <p className="flex items-center gap-2 text-xs text-slate-500">
                    <CheckCircle className="h-3.5 w-3.5 text-brand-green" />
                    Published: {format(parseISO(selectedEvent.extendedProps.published_at), "MMM d, yyyy - h:mm a")}
                  </p>
                ) : null}
                {selectedEvent.extendedProps.campaign_name ? (
                  <p className="text-xs text-slate-500">Campaign: {selectedEvent.extendedProps.campaign_name}</p>
                ) : null}
                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold capitalize text-slate-500">
                  {selectedEvent.extendedProps.post_type}
                </span>
              </div>

              {["scheduled", "draft"].includes(selectedStatus) ? (
                <div className="mb-3 rounded-2xl bg-blue-50 p-3 text-center text-xs font-semibold text-blue-600">
                  Drag this post on the calendar to reschedule it.
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/schedule?edit=${selectedEvent.extendedProps.post_id}`)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/analytics?postId=${selectedEvent.extendedProps.post_id}`)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  Analytics
                </button>
                {["draft", "scheduled"].includes(selectedStatus) ? (
                  <button
                    type="button"
                    onClick={() => handlePublishNow(selectedEvent.extendedProps.post_id)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-brand-green px-3 py-2 text-xs font-bold text-white"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Publish
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setDeleteTarget({ postId: selectedEvent.extendedProps.post_id, title: selectedEvent.title })}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-2xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-100 ${
                    ["draft", "scheduled"].includes(selectedStatus) ? "" : "col-span-2"
                  }`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="app-surface p-6 text-center">
            <CalendarDays className="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <p className="font-bold text-slate-700">Post Details</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">Click a post on the calendar to inspect it, edit it, publish it, or view analytics.</p>
          </div>
        )}

        {unscheduledPosts.length ? (
          <div className="app-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <FileText className="h-4 w-4 text-slate-400" />
                Unscheduled Drafts
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{unscheduledPosts.length}</span>
              </h3>
              <button type="button" onClick={() => setShowUnscheduled((current) => !current)} className="text-xs font-bold text-slate-400">
                {showUnscheduled ? "Hide" : "Show"}
              </button>
            </div>
            {showUnscheduled ? (
              <div className="space-y-2">
                {unscheduledPosts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => navigate(`/schedule?edit=${post.extendedProps.post_id}`)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-slate-200 p-3 text-left hover:border-orange-200 hover:bg-orange-50"
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: post.backgroundColor }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-slate-700">{post.title}</span>
                      <span className="text-xs text-slate-400">{post.extendedProps.platform} - {post.extendedProps.post_type}</span>
                    </span>
                    <Plus className="h-4 w-4 text-slate-300" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="app-surface p-4">
          <h3 className="mb-3 text-sm font-bold text-slate-700">Visible Range</h3>
          <div className="space-y-2">
            {[
              ["Scheduled", "scheduled", "bg-orange-400"],
              ["Published", "published", "bg-green-400"],
              ["Drafts", "draft", "bg-slate-300"],
              ["Failed", "failed", "bg-rose-400"]
            ].map(([label, status, color]) => (
              <div key={status} className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                <span className="flex-1 text-xs font-semibold text-slate-500">{label}</span>
                <span className="text-xs font-bold text-slate-900">{stats[status]}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete post?"
        message={`Are you sure you want to delete "${deleteTarget?.title || "this post"}"? This cannot be undone.`}
        confirmLabel="Delete"
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
