import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Image, Plus, RefreshCw, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/api";

export default function HashtagRecommendations({
  postId,
  caption,
  platform,
  postType,
  mediaUrl,
  onAdd
}) {
  const [hashtags, setHashtags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(new Set());
  const [source, setSource] = useState("");
  const lastAutoMediaUrlRef = useRef("");

  const normalizedMediaUrl = String(mediaUrl || "").trim();

  const generateRecommendations = useCallback(async (regenerate = false) => {
    setLoading(true);

    try {
      const shouldUseSavedPost = Boolean(postId) && !regenerate && !normalizedMediaUrl;
      let result = [];
      let nextSource = "";

      if (shouldUseSavedPost) {
        const response = await api.get(`/hashtags/recommendations/${postId}`, {
          params: { regenerate: false, includeCaptions: false }
        });
        const payload = response.data?.data || {};
        result = payload.hashtags || payload || [];
        nextSource = payload.source || response.data?.source || "";
      } else {
        const response = await api.post("/hashtags/ai/from-image", {
          caption: caption || "",
          platform: platform || "instagram",
          postType: postType || "feed",
          mediaUrl: normalizedMediaUrl || null
        });
        result = response.data?.data || [];
        nextSource = response.data?.source || "ai";
      }

      setHashtags(Array.isArray(result) ? result : []);
      setSource(nextSource);
    } catch (error) {
      toast.error(error.response?.data?.error || "Unable to generate hashtags.");
    } finally {
      setLoading(false);
    }
  }, [caption, normalizedMediaUrl, platform, postId, postType]);

  useEffect(() => {
    setHashtags([]);
    setAdded(new Set());
    setSource("");
    lastAutoMediaUrlRef.current = "";
  }, [normalizedMediaUrl]);

  useEffect(() => {
    if (!normalizedMediaUrl || loading) {
      return;
    }

    if (lastAutoMediaUrlRef.current === normalizedMediaUrl) {
      return;
    }

    lastAutoMediaUrlRef.current = normalizedMediaUrl;
    generateRecommendations(false);
  }, [generateRecommendations, loading, normalizedMediaUrl]);

  function handleAdd(tag) {
    onAdd?.(tag);
    setAdded((current) => new Set([...current, tag]));
  }

  function handleAddAll() {
    hashtags.forEach((item) => handleAdd(item.tag || item));
  }

  return (
    <div className="rounded-2xl border-2 border-violet-200 bg-violet-50/80 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-purple" />
          <span className="text-sm font-bold text-brand-purple">AI Hashtag Suggestions</span>
          {source ? (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-brand-purple">
              {source === "cached" ? "Cached" : normalizedMediaUrl ? "From image" : "AI"}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => generateRecommendations(Boolean(normalizedMediaUrl))}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-xl bg-brand-purple px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          <Sparkles className="h-3 w-3" />
          {hashtags.length ? "Regenerate" : "Generate"}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-sm font-semibold text-brand-purple">
          <RefreshCw className="h-4 w-4 animate-spin" />
          {normalizedMediaUrl ? "Analyzing your image..." : "Generating hashtags..."}
        </div>
      ) : null}

      {normalizedMediaUrl && !loading && !hashtags.length ? (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-violet-100 px-3 py-2 text-xs font-medium text-brand-purple">
          <Image className="h-3 w-3" />
          Image detected. Hashtags will be generated from the uploaded photo.
        </div>
      ) : null}

      {!loading && hashtags.length ? (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {hashtags.map((item, index) => {
              const tag = item.tag || item.suggested_hashtag || item;
              const isAdded = added.has(tag);
              const score = item.relevance_score || item.score;

              return (
                <button
                  key={`${tag}-${index}`}
                  type="button"
                  onClick={() => handleAdd(tag)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    isAdded
                      ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                      : "border-violet-200 bg-white text-brand-purple hover:bg-violet-100"
                  }`}
                >
                  {isAdded ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {tag}
                  {score ? <span className="text-violet-400">{Math.round(Number(score) * 100)}%</span> : null}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleAddAll}
              className="text-xs font-bold text-brand-purple hover:text-brand-orange"
            >
              Add all {hashtags.length} hashtags
            </button>

            <button
              type="button"
              onClick={() => generateRecommendations(true)}
              disabled={loading}
              className="inline-flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-brand-purple disabled:opacity-50"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          </div>
        </>
      ) : null}

      {!loading && !hashtags.length && !normalizedMediaUrl ? (
        <p className="text-xs font-medium text-violet-400">
          Upload a photo or click Generate for AI hashtag suggestions.
        </p>
      ) : null}
    </div>
  );
}
