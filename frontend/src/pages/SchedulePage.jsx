import { format } from "date-fns";
import { ChevronDown, ImagePlus, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import { accountsApi, analyticsApi, campaignsApi, hashtagsApi, mediaApi, postsApi, schedulesApi } from "../api/services";
import { useAuth } from "../context/AuthContext";
import { useSocketEvent } from "../hooks/useSocket";
import { socket } from "../socket/socket";
import { EVENTS } from "../socket/events";
import CaptionSuggestions from "../components/ai/CaptionSuggestions";
import HashtagRecommendations from "../components/ai/HashtagRecommendations";
import EmptyState from "../components/shared/EmptyState";
import { PageCard } from "../components/shared/Ui";
import { normalizeTimeZone } from "../utils/timezone";
import "../styles/phoneMockup.css";

const postTypes = ["Feed", "Story", "Reel", "Carousel"];
const publishModes = ["Publish Now", "Schedule for Later", "Recurring"];
const timezones = ["Asia/Kolkata", "UTC", "America/New_York", "Europe/London"];
const recurrenceDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const maxLengthByPlatform = {
  instagram: 2200,
  facebook: 63206,
  linkedin: 3000
};

function toWeekday(day) {
  return {
    Mon: "Monday",
    Tue: "Tuesday",
    Wed: "Wednesday",
    Thu: "Thursday",
    Fri: "Friday",
    Sat: "Saturday",
    Sun: "Sunday"
  }[day];
}

function toWeekdayShort(day) {
  return {
    Monday: "Mon",
    Tuesday: "Tue",
    Wednesday: "Wed",
    Thursday: "Thu",
    Friday: "Fri",
    Saturday: "Sat",
    Sunday: "Sun"
  }[day];
}

function formatHourLabel(hour) {
  const date = new Date();
  date.setHours(Number(hour) || 0, 0, 0, 0);

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function nextScheduledDate(dayOfWeek, hour) {
  const targetDay = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(dayOfWeek);
  const next = new Date();
  next.setHours(Number(hour) || 0, 0, 0, 0);

  if (targetDay >= 0) {
    const offset = (targetDay - next.getDay() + 7) % 7;
    next.setDate(next.getDate() + offset);

    if (offset === 0 && next <= new Date()) {
      next.setDate(next.getDate() + 7);
    }
  } else if (next <= new Date()) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

function formatDateTimeForTimezone(date, timeZone) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function formatCaptionWithHashtags(caption) {
  if (!caption) return null;

  return caption.split(/(\s+)/).map((word, i) =>
    word.startsWith("#") ? (
      <span key={i} className="phone-hashtag">
        {word}
      </span>
    ) : (
      word
    )
  );
}

function toMediaPreview(item) {
  if (!item) return null;

  const previewUrl =
    item.preview_url
    || item.absolute_url
    || (item.public_url || item.url
      ? `${window.location.protocol}//${window.location.hostname}:5000${item.public_url || item.url}`
      : null);

  if (!previewUrl) return null;

  return {
    url: previewUrl,
    type: item.mime_type || item.type || ""
  };
}

function PhonePreview({ platform, accountHandle, caption, mediaPreview, scheduledAt }) {
  const [activeTab, setActiveTab] = useState(platform || "instagram");
  const initials = accountHandle ? accountHandle.slice(0, 2).toUpperCase() : "SM";

  const platformLabel = {
    instagram: "Instagram",
    facebook: "Facebook",
    linkedin: "LinkedIn"
  };

  const headerClass = {
    instagram: "phone-app-header-instagram",
    facebook: "phone-app-header-facebook",
    linkedin: "phone-app-header-linkedin"
  };

  const headerText = {
    instagram: "Instagram",
    facebook: "facebook",
    linkedin: "LinkedIn"
  };

  const avatarClass = {
    instagram: "phone-avatar phone-avatar-instagram",
    facebook: "phone-avatar",
    linkedin: "phone-avatar"
  };

  return (
    <div className="phone-mockup-wrapper">
      <div className="platform-tabs">
        {["instagram", "facebook", "linkedin"].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setActiveTab(p)}
            className={`platform-tab ${activeTab === p ? `active-${p}` : ""}`}
          >
            {platformLabel[p]}
          </button>
        ))}
      </div>

      <div className="phone-shell">
        <div className="phone-screen">
          <div className="phone-notch" />

          <div className="phone-status-bar">
            <span>9:41</span>
            <div className="status-bar-right">
              <span>...</span>
              <span>WiFi</span>
              <span>100%</span>
            </div>
          </div>

          <div className="phone-app-header">
            <span className={headerClass[activeTab]}>{headerText[activeTab]}</span>
            <div style={{ display: "flex", gap: 14 }}>
              <span style={{ fontSize: 20, cursor: "default" }}>♡</span>
              <span style={{ fontSize: 20, cursor: "default" }}>✈</span>
            </div>
          </div>

          <div className={`phone-post phone-post-${activeTab}`}>
            {scheduledAt && (
              <div className="phone-scheduled-badge">
                🕐 {scheduledAt}
              </div>
            )}

            <div className="phone-post-header">
              <div className={avatarClass[activeTab]}>{initials}</div>
              <div>
                <div className="phone-handle">{accountHandle || "your_account"}</div>
                {activeTab === "linkedin" && <div className="phone-handle-sub">Your Company · Just now</div>}
              </div>
              <div className="phone-follow-btn">
                {activeTab === "instagram" ? "Follow" : activeTab === "facebook" ? "Like Page" : "Connect"}
              </div>
            </div>

            <div className="phone-media-area">
              {mediaPreview ? (
                mediaPreview.type?.startsWith("video") ? (
                  <video src={mediaPreview.url} muted autoPlay loop />
                ) : (
                  <img src={mediaPreview.url} alt="Preview" />
                )
              ) : (
                <div className="phone-media-placeholder">
                  <svg className="phone-media-placeholder-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="phone-media-placeholder-text">Media preview</span>
                </div>
              )}
            </div>

            {activeTab !== "linkedin" && (
              <div className="phone-action-bar">
                <svg className="phone-action-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <svg className="phone-action-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <svg className="phone-action-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <svg className="phone-action-icon phone-action-icon-save" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
            )}

            <div className="phone-likes">143 likes</div>

            <div className="phone-caption">
              {caption ? (
                <>
                  <span className="phone-caption-handle">{accountHandle || "your_account"}</span>
                  {formatCaptionWithHashtags(caption)}
                </>
              ) : (
                <span className="phone-caption-empty">Your caption will appear here...</span>
              )}
            </div>

            <div className="phone-comments">View all 24 comments</div>
            <div className="phone-timestamp">{scheduledAt ? `Scheduled · ${scheduledAt}` : "Just now"}</div>
          </div>
        </div>
      </div>

      <div className="phone-preview-label">Live Preview</div>
    </div>
  );
}

export default function SchedulePage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const userTimezone = useMemo(
    () => normalizeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || user?.timezone || "Asia/Kolkata"),
    [user?.timezone]
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [aiOpen, setAiOpen] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [availableHashtags, setAvailableHashtags] = useState([]);
  const [bestTimes, setBestTimes] = useState([]);
  const [uploadedMedia, setUploadedMedia] = useState([]);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [hashtagInput, setHashtagInput] = useState("");
  const [previewPlatform, setPreviewPlatform] = useState("instagram");
  const [savedPostId, setSavedPostId] = useState(searchParams.get("edit") || "");
  const [teammateTyping, setTeammateTyping] = useState(null);
  const [form, setForm] = useState({
    accountId: "",
    postType: "Feed",
    caption: "",
    publishMode: "Schedule for Later",
    scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
    timezone: userTimezone,
    recurrenceType: "Weekly",
    recurrenceDays: ["Mon", "Wed", "Fri"],
    dayOfMonth: 1,
    campaignId: "",
    hashtags: []
  });

  useEffect(() => {
    document.title = "Schedule Post | Smart Social";
  }, []);

  useEffect(() => {
    return () => {
      uploadedMedia.forEach((item) => {
        if (item.preview_url?.startsWith("blob:")) {
          URL.revokeObjectURL(item.preview_url);
        }
      });
    };
  }, [uploadedMedia]);

  useEffect(() => {
    return () => {
      window.clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    setForm((current) => (
      current.timezone
        ? current
        : { ...current, timezone: userTimezone }
    ));
  }, [userTimezone]);

  useEffect(() => {
    Promise.all([
      accountsApi.list(),
      campaignsApi.list(),
      hashtagsApi.list()
    ])
      .then(([accountsPayload, campaignsPayload, hashtagPayload]) => {
        const accountItems = accountsPayload?.items || accountsPayload?.data || (Array.isArray(accountsPayload) ? accountsPayload : []);
        const campaignItems = campaignsPayload?.items || campaignsPayload?.data || (Array.isArray(campaignsPayload) ? campaignsPayload : []);
        const hashtagItems = hashtagPayload?.items || hashtagPayload?.data || (Array.isArray(hashtagPayload) ? hashtagPayload : []);
        const firstAccountId = String(accountItems[0]?.id || accountItems[0]?.account_id || "");
        const firstPlatform = accountItems[0]?.platform?.slug || "instagram";

        setAccounts(accountItems);
        setCampaigns(campaignItems);
        setAvailableHashtags(hashtagItems);
        setPreviewPlatform(firstPlatform);
        setForm((current) => ({
          ...current,
          accountId: current.accountId || firstAccountId,
          campaignId: current.campaignId || String(campaignItems[0]?.id || campaignItems[0]?.campaign_id || "")
        }));
      })
      .catch(() => {
        toast.error("Unable to load scheduler data.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user?.timezone]);

  useEffect(() => {
    if (!form.accountId) {
      return;
    }

    analyticsApi
      .bestTimes(form.accountId)
      .then((payload) => {
        setBestTimes(payload?.slots || (Array.isArray(payload) ? payload : []));
      })
      .catch(() => {
        toast.error("Unable to load best posting times.");
      });
  }, [form.accountId]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => String(account.id) === String(form.accountId)),
    [accounts, form.accountId]
  );

  const captionLimit = maxLengthByPlatform[selectedAccount?.platform?.slug || previewPlatform] || 2200;
  const captionCount = form.caption.length;

  const suggestedBestTimes = useMemo(() => {
    return [...bestTimes]
      .sort((left, right) => Number(right.engagement_score || 0) - Number(left.engagement_score || 0))
      .slice(0, 3)
      .map((item) => ({
        ...item,
        shortDay: toWeekdayShort(item.day_of_week),
        label: `${toWeekdayShort(item.day_of_week)} ${formatHourLabel(item.best_hour)}`
      }));
  }, [bestTimes]);

  const filteredHashtags = useMemo(() => {
    if (!hashtagInput.trim()) {
      return [];
    }

    return availableHashtags
      .filter((item) => item.tag.toLowerCase().includes(hashtagInput.toLowerCase()))
      .slice(0, 6);
  }, [availableHashtags, hashtagInput]);

  const previewCaption = `${form.caption}${form.hashtags.length ? ` ${form.hashtags.join(" ")}` : ""}`.trim();
  const hashtagSourceMediaUrl = useMemo(() => {
    const latestImage = [...uploadedMedia]
      .reverse()
      .find((item) => String(item.mime_type || item.type || "").startsWith("image/"));

    return latestImage?.public_url || latestImage?.url || latestImage?.absolute_url || null;
  }, [uploadedMedia]);
  const editingPostId = searchParams.get("edit") || "new";

  const handleCaptionChange = useCallback((event) => {
    const nextCaption = event.target.value;
    setForm((current) => ({ ...current, caption: nextCaption }));

    if (!user?.team_id || !(user?.user_id || user?.id)) {
      return;
    }

    const payload = {
      teamId: user.team_id,
      userId: user.user_id || user.id,
      postId: editingPostId
    };

    socket.emit(EVENTS.POST_TYPING, payload);
    window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      socket.emit(EVENTS.POST_TYPING_STOP, payload);
    }, 2000);
  }, [editingPostId, user?.team_id, user?.user_id, user?.id]);

  useSocketEvent(
    EVENTS.POST_TYPING,
    useCallback((data) => {
      if (!data?.userId || String(data.userId) === String(user?.user_id || user?.id)) return;
      if (data.postId && String(data.postId) !== String(editingPostId)) return;
      setTeammateTyping(data.userId);
    }, [editingPostId, user?.user_id, user?.id])
  );

  useSocketEvent(
    EVENTS.POST_TYPING_STOP,
    useCallback((data) => {
      if (!data?.userId || String(data.userId) === String(user?.user_id || user?.id)) return;
      if (data.postId && String(data.postId) !== String(editingPostId)) return;
      setTeammateTyping(null);
    }, [editingPostId, user?.user_id, user?.id])
  );

  async function uploadFiles(files) {
    if (!files.length) {
      return;
    }

    const [firstFile] = files;
    const localPreviews = files.map((file) => ({
      preview_url: URL.createObjectURL(file),
      type: file.type
    }));

    setMediaPreview({
      url: localPreviews[0].preview_url,
      type: firstFile.type
    });

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    try {
      const payload = await mediaApi.upload(formData);
      const nextItems = payload.map((file, index) => {
        const publicUrl = file.public_url || file.url;
        return {
          ...file,
          media_id: file.media_id || file.id || file.filename,
          preview_url: localPreviews[index]?.preview_url,
          type: localPreviews[index]?.type || file.mime_type,
          absolute_url: publicUrl
            ? `${window.location.protocol}//${window.location.hostname}:5000${publicUrl}`
            : null
        };
      });

      setUploadedMedia((current) => [...current, ...nextItems]);
      setMediaPreview((current) => current || toMediaPreview(nextItems[0]));
      toast.success("Media uploaded.");
    } catch (error) {
      localPreviews.forEach((item) => {
        if (item.preview_url?.startsWith("blob:")) {
          URL.revokeObjectURL(item.preview_url);
        }
      });
      toast.error(error?.response?.data?.error || "Unable to upload media.");
    } finally {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function removeUploadedMedia(mediaId) {
    setUploadedMedia((current) => {
      const nextItems = current.filter((item) => String(item.media_id) !== String(mediaId));
      const removedItem = current.find((item) => String(item.media_id) === String(mediaId));

      if (removedItem?.preview_url?.startsWith("blob:")) {
        URL.revokeObjectURL(removedItem.preview_url);
      }

      setMediaPreview((currentPreview) => {
        if (!currentPreview) {
          return toMediaPreview(nextItems[0]);
        }

        const removedPreview = toMediaPreview(removedItem);
        if (removedPreview?.url === currentPreview.url) {
          return toMediaPreview(nextItems[0]);
        }

        return currentPreview;
      });

      return nextItems;
    });
  }

  function addHashtag(tag) {
    if (!tag) {
      return;
    }

    const normalized = tag.startsWith("#") ? tag : `#${tag}`;
    setForm((current) => ({
      ...current,
      hashtags: current.hashtags.includes(normalized) ? current.hashtags : [...current.hashtags, normalized]
    }));
    setHashtagInput("");
  }

  async function handleSubmit(submitMode) {
    if (!form.accountId) {
      toast.error("Select a social account first.");
      return;
    }

    if (!form.caption.trim()) {
      toast.error("Add a caption before saving this post.");
      return;
    }

    setSubmitting(true);

    try {
      const effectiveTimezone = form.timezone || userTimezone || "Asia/Kolkata";
      const scheduledForValue =
        submitMode === "schedule" || submitMode === "recurring"
          ? formatDateTimeForTimezone(form.scheduledAt, effectiveTimezone)
          : null;

      const postPayload = {
        title: `${form.postType} post`,
        caption: previewCaption,
        social_account_id: form.accountId,
        campaign_id: form.campaignId || null,
        timezone: effectiveTimezone,
        media_ids: uploadedMedia.map((item) => item.media_id).filter(Boolean),
        post_type: form.postType.toLowerCase()
      };

      let createdPost = null;

      if (submitMode === "draft") {
        createdPost = await postsApi.create({
          ...postPayload,
          publish_status: "draft",
          scheduled_for: null
        });
        toast.success("Draft saved.");
      } else if (submitMode === "schedule") {
        createdPost = await postsApi.create({
          ...postPayload,
          publish_status: "scheduled",
          scheduled_for: scheduledForValue
        });
        toast.success("Post scheduled.");
      } else if (submitMode === "publish") {
        createdPost = await postsApi.create({
          ...postPayload,
          publish_status: "draft",
          scheduled_for: null
        });
        await postsApi.publishNow(createdPost.id);
        toast.success("Post published.");
      } else if (submitMode === "recurring") {
        if (form.recurrenceType === "Weekly" && !form.recurrenceDays.length) {
          throw new Error("Pick at least one day for a weekly recurring post.");
        }

        createdPost = await postsApi.create({
          ...postPayload,
          publish_status: "draft",
          scheduled_for: null,
          recurring_pattern: form.recurrenceType.toLowerCase()
        });

        const recurrenceScheduleDays =
          form.recurrenceType === "Weekly"
            ? form.recurrenceDays.map((day) => toWeekday(day))
            : [null];

        await Promise.all(
          recurrenceScheduleDays.map((dayOfWeek) =>
            schedulesApi.createRecurring({
              post_id: createdPost.id,
              frequency: form.recurrenceType.toLowerCase(),
              day_of_week: dayOfWeek,
              day_of_month: form.recurrenceType === "Monthly" ? form.dayOfMonth : null,
              hour_of_day: form.scheduledAt.getHours(),
              timezone: effectiveTimezone
            })
          )
        );
        toast.success("Recurring schedule created.");
      }

      const nextPostId = createdPost?.id || createdPost?.post_id || "";
      if (nextPostId) {
        setSavedPostId(String(nextPostId));
      }

      setForm((current) => ({
        ...current,
        caption: "",
        hashtags: [],
        publishMode: "Schedule for Later",
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000)
      }));
      uploadedMedia.forEach((item) => {
        if (item.preview_url?.startsWith("blob:")) {
          URL.revokeObjectURL(item.preview_url);
        }
      });
      setUploadedMedia([]);
      setMediaPreview(null);
    } catch (error) {
      toast.error(
        error?.response?.data?.error
          || error?.response?.data?.message
          || error?.message
          || "Unable to save this post."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="app-surface animate-pulse p-6">
          <div className="h-8 w-40 rounded bg-slate-100" />
          <div className="mt-4 h-96 rounded-2xl bg-slate-100" />
        </div>
        <div className="app-surface animate-pulse p-6">
          <div className="h-[32rem] rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <div className="space-y-6">
        <PageCard title="Schedule a Post" subtitle="Compose once, then publish now, later, or on repeat.">
          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Account & Platform</h3>
              {!accounts.length ? (
                <EmptyState
                  title="No connected accounts"
                  description="Connect a social account before creating your next post."
                />
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <select className="app-input" value={form.accountId} onChange={(event) => {
                  const nextAccount = accounts.find((account) => String(account.id) === event.target.value);
                  setForm((current) => ({ ...current, accountId: event.target.value }));
                  setPreviewPlatform(nextAccount?.platform?.slug || "instagram");
                }}>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.platform?.name} - {account.account_name}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {postTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, postType: type }))}
                      className={`rounded-2xl px-3 py-3 text-sm font-semibold transition ${form.postType === type ? "bg-brand-purple text-white" : "border border-slate-200 bg-white text-slate-600"}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Content</h3>
              <textarea
                className="app-input min-h-40 resize-none"
                value={form.caption}
                maxLength={captionLimit}
                onChange={handleCaptionChange}
                placeholder="Write your post caption..."
              />
              {teammateTyping ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-brand-purple">
                  <div className="flex gap-0.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-purple" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-purple" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-purple" style={{ animationDelay: "300ms" }} />
                  </div>
                  A teammate is editing this post...
                </div>
              ) : null}
              <div className="flex justify-end text-xs font-medium text-slate-400">
                {captionCount}/{captionLimit}
              </div>

              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  uploadFiles(Array.from(event.dataTransfer.files));
                }}
                className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center"
              >
                <UploadCloud className="mx-auto h-10 w-10 text-brand-purple" />
                <p className="mt-3 font-semibold text-slate-800">Drag & drop media here</p>
                <p className="mt-1 text-sm text-slate-500">Upload photos or videos for feed, reel, story, or carousel posts.</p>
                <button type="button" onClick={() => inputRef.current?.click()} className="app-button-secondary mt-4">
                  <ImagePlus className="mr-2 h-4 w-4" />
                  Choose files
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => uploadFiles(Array.from(event.target.files || []))}
                />
              </div>

              {uploadedMedia.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {uploadedMedia.map((file) => (
                    <div key={file.media_id} className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-100">
                        <img src={file.absolute_url || `${window.location.protocol}//${window.location.hostname}:5000${file.public_url || file.url}`} alt={file.original_name} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeUploadedMedia(file.media_id)}
                          className="absolute right-2 top-2 rounded-full bg-slate-900/75 px-2 py-1 text-xs font-semibold text-white transition hover:bg-slate-900"
                        >
                          Remove
                        </button>
                      </div>
                      <p className="mt-2 truncate text-xs font-medium text-slate-500">{file.original_name}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
              <button type="button" onClick={() => setAiOpen((current) => !current)} className="flex w-full items-center justify-between text-left">
                <div>
                  <p className="text-sm font-semibold text-brand-purple">AI Suggestions</p>
                  <p className="text-sm text-slate-500">Generate captions and hashtag strategy with AI.</p>
                </div>
                <ChevronDown className={`h-5 w-5 text-brand-purple transition ${aiOpen ? "rotate-180" : ""}`} />
              </button>

              {aiOpen ? (
                <div className="mt-4 space-y-4">
                  <CaptionSuggestions
                    postId={savedPostId}
                    platform={selectedAccount?.platform?.slug || previewPlatform}
                    mediaType={form.postType.toLowerCase()}
                    existingCaption={form.caption}
                    mediaIds={uploadedMedia.map((item) => item.media_id).filter(Boolean)}
                    mediaUrls={uploadedMedia.map((item) => item.public_url || item.url).filter(Boolean)}
                    onUse={(text) => setForm((current) => ({ ...current, caption: text }))}
                  />
                  <HashtagRecommendations
                    postId={savedPostId}
                    caption={form.caption}
                    platform={selectedAccount?.platform?.slug || previewPlatform}
                    postType={form.postType.toLowerCase()}
                    mediaUrl={hashtagSourceMediaUrl}
                    onAdd={(tag) => addHashtag(tag)}
                  />
                </div>
              ) : null}
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Scheduling</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                {publishModes.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, publishMode: mode }))}
                    className={`rounded-2xl px-3 py-3 text-sm font-semibold transition ${form.publishMode === mode ? "bg-brand-orange text-white" : "border border-slate-200 bg-white text-slate-600"}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {form.publishMode !== "Publish Now" ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <DatePicker
                      selected={form.scheduledAt}
                      onChange={(value) => setForm((current) => ({ ...current, scheduledAt: value || new Date() }))}
                      showTimeSelect
                      dateFormat="MMM d, yyyy h:mm aa"
                      className="app-input"
                    />
                    <select className="app-input" value={form.timezone} onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}>
                      {timezones.map((timezone) => (
                        <option key={timezone} value={timezone}>
                          {timezone}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Timezone: {form.timezone || userTimezone}
                  </p>
                </>
              ) : null}

              {form.publishMode === "Schedule for Later" ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {suggestedBestTimes.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, scheduledAt: nextScheduledDate(slot.day_of_week, slot.best_hour) }))}
                        className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700"
                      >
                        {slot.label}
                      </button>
                    ))}
                  </div>
                  {suggestedBestTimes.length ? (
                    <p className="text-xs text-slate-500">Recommended slots based on recent engagement patterns.</p>
                  ) : null}
                </div>
              ) : null}

              {form.publishMode === "Recurring" ? (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <select className="app-input" value={form.recurrenceType} onChange={(event) => setForm((current) => ({ ...current, recurrenceType: event.target.value }))}>
                      <option>Daily</option>
                      <option>Weekly</option>
                      <option>Monthly</option>
                    </select>
                    {form.recurrenceType === "Monthly" ? (
                      <input
                        className="app-input"
                        type="number"
                        min="1"
                        max="31"
                        value={form.dayOfMonth}
                        onChange={(event) => setForm((current) => ({ ...current, dayOfMonth: Number(event.target.value) }))}
                      />
                    ) : null}
                  </div>

                  {form.recurrenceType === "Weekly" ? (
                    <div className="flex flex-wrap gap-2">
                      {recurrenceDays.map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              recurrenceDays: current.recurrenceDays.includes(day)
                                ? current.recurrenceDays.filter((item) => item !== day)
                                : [...current.recurrenceDays, day]
                            }))
                          }
                          className={`rounded-full px-3 py-2 text-xs font-semibold ${form.recurrenceDays.includes(day) ? "bg-brand-purple text-white" : "bg-white text-slate-600"}`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {suggestedBestTimes.length ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Best Weekly Slots</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {suggestedBestTimes.map((slot) => (
                          <button
                            key={`${slot.id}-recurring`}
                            type="button"
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                scheduledAt: nextScheduledDate(slot.day_of_week, slot.best_hour),
                                recurrenceDays: current.recurrenceType === "Weekly" ? [slot.shortDay] : current.recurrenceDays
                              }))
                            }
                            className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-brand-purple shadow-sm"
                          >
                            {slot.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Campaign & Hashtags</h3>
              <select className="app-input" value={form.campaignId} onChange={(event) => setForm((current) => ({ ...current, campaignId: event.target.value }))}>
                <option value="">No campaign</option>
                  {campaigns.map((campaign) => (
                  <option key={campaign.id || campaign.campaign_id} value={campaign.id || campaign.campaign_id}>
                    {campaign.name || campaign.campaign_name}
                  </option>
                ))}
              </select>

              <div className="relative">
                <input
                  className="app-input"
                  value={hashtagInput}
                  onChange={(event) => setHashtagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addHashtag(hashtagInput);
                    }
                  }}
                  placeholder="Type # to search or add hashtags"
                />
                {filteredHashtags.length ? (
                  <div className="absolute z-10 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
                    {filteredHashtags.map((item) => (
                      <button key={item.id} type="button" onClick={() => addHashtag(item.tag)} className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50">
                        {item.tag}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {form.hashtags.length ? (
                <div className="flex flex-wrap gap-2">
                  {form.hashtags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-2 text-xs font-semibold text-brand-purple">
                      {tag}
                      <button type="button" onClick={() => setForm((current) => ({ ...current, hashtags: current.hashtags.filter((item) => item !== tag) }))}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </section>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleSubmit("draft")}
                disabled={submitting || !accounts.length}
                className="app-button-secondary"
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(form.publishMode === "Recurring" ? "recurring" : "schedule")}
                disabled={submitting || !accounts.length}
                className="app-button-primary"
              >
                {form.publishMode === "Recurring" ? "Create Recurring" : "Schedule"}
              </button>
              <button
                type="button"
                onClick={() => handleSubmit("publish")}
                disabled={submitting || !accounts.length}
                className="app-button-success"
              >
                Publish Now
              </button>
            </div>
          </div>
        </PageCard>
      </div>

      <div className="space-y-6">
        <PageCard title="Live Preview" subtitle="See how your post looks on mobile before publishing.">
          <PhonePreview
            platform={selectedAccount?.platform?.slug || "instagram"}
            accountHandle={selectedAccount?.account_name}
            caption={previewCaption}
            mediaPreview={mediaPreview}
            scheduledAt={form.publishMode === "Publish Now" ? null : format(form.scheduledAt, "MMM d · h:mm a")}
          />
        </PageCard>
      </div>
    </div>
  );
}
