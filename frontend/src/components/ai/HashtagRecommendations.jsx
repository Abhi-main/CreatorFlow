import { useState } from "react";
import { Check, Plus, RefreshCw, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/api";

export default function HashtagRecommendations({ postId, onAdd }) {
  const [hashtags, setHashtags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(new Set());
  const [source, setSource] = useState("");

  async function fetchRecommendations(regenerate = false) {
    if (!postId) {
      toast.error("Save the post first to generate hashtag suggestions.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/hashtags/recommendations/${postId}`, {
        params: { regenerate, includeCaptions: false }
      });
      const payload = response.data?.data || {};
      setHashtags(payload.hashtags || payload || []);
      setSource(payload.source || response.data?.source || "");
    } catch (error) {
      toast.error(error.response?.data?.error || "Unable to generate hashtags.");
    } finally {
      setLoading(false);
    }
  }

  function handleAdd(tag) {
    onAdd?.(tag);
    setAdded((current) => new Set([...current, tag]));
  }

  return (
    <div className="rounded-2xl border-2 border-violet-200 bg-violet-50/80 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-purple" />
          <span className="text-sm font-bold text-brand-purple">AI Hashtag Suggestions</span>
          {source === "cached" ? (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-brand-purple">Cached</span>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fetchRecommendations(false)}
            disabled={loading || !postId}
            className="inline-flex items-center gap-1 rounded-xl bg-brand-purple px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            <Sparkles className="h-3 w-3" />
            {hashtags.length ? "Show" : "Generate"}
          </button>
          {hashtags.length ? (
            <button
              type="button"
              onClick={() => fetchRecommendations(true)}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-brand-purple disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-sm font-semibold text-brand-purple">
          <RefreshCw className="h-4 w-4 animate-spin" />
          AI is analyzing your post...
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
                  title={item.reason || ""}
                >
                  {isAdded ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {tag}
                  {score ? <span className="text-violet-400">{Math.round(Number(score) * 100)}%</span> : null}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => hashtags.forEach((item) => handleAdd(item.tag || item.suggested_hashtag || item))}
            className="text-xs font-bold text-brand-purple hover:text-brand-orange"
          >
            Add all hashtags
          </button>
        </>
      ) : null}

      {!loading && !hashtags.length ? (
        <p className="text-xs font-medium text-violet-400">
          {postId ? "Generate GPT-powered hashtag suggestions." : "Save this post first to generate hashtag suggestions."}
        </p>
      ) : null}
    </div>
  );
}
