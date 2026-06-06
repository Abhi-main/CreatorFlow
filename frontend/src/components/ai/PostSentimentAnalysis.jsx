import { useState } from "react";
import { AlertCircle, CheckCircle, RefreshCw, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/api";

const sentimentLabel = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative"
};

function scoreColor(score) {
  if (Number(score) >= 8) return "text-emerald-600";
  if (Number(score) >= 5) return "text-amber-600";
  return "text-rose-500";
}

export default function PostSentimentAnalysis({ postId }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  async function analyze() {
    if (!postId) return;

    setLoading(true);
    try {
      const response = await api.get(`/hashtags/ai/post-sentiment/${postId}`);
      setAnalysis(response.data?.data || null);
    } catch (error) {
      toast.error(error.response?.data?.error || "Unable to analyze post performance.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-purple" />
          <span className="text-sm font-bold text-slate-700">AI Performance Analysis</span>
        </div>
        <button
          type="button"
          onClick={analyze}
          disabled={loading || !postId}
          className="inline-flex items-center gap-1 rounded-lg bg-brand-purple px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {analysis ? "Re-analyze" : "Analyze"}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-3 text-sm font-semibold text-brand-purple">
          <RefreshCw className="h-4 w-4 animate-spin" />
          AI is analyzing post performance...
        </div>
      ) : null}

      {analysis && !loading ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <p className={`text-3xl font-black ${scoreColor(analysis.performance_score)}`}>{analysis.performance_score}/10</p>
              <p className="mt-1 text-xs text-slate-500">Performance Score</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="text-2xl font-black text-slate-800">{sentimentLabel[analysis.sentiment] || analysis.sentiment}</p>
              <p className="mt-1 text-xs text-slate-500">Sentiment</p>
            </div>
          </div>

          <p className="rounded-xl bg-blue-50 p-3 text-sm leading-6 text-slate-600">{analysis.summary}</p>

          {analysis.strengths?.length ? (
            <div>
              <p className="mb-1.5 flex items-center gap-1 text-xs font-bold text-emerald-700">
                <CheckCircle className="h-3.5 w-3.5" />
                What Worked
              </p>
              {analysis.strengths.map((item, index) => (
                <p key={`${item}-${index}`} className="mb-1 text-xs text-slate-600">
                  + {item}
                </p>
              ))}
            </div>
          ) : null}

          {analysis.improvements?.length ? (
            <div>
              <p className="mb-1.5 flex items-center gap-1 text-xs font-bold text-orange-700">
                <AlertCircle className="h-3.5 w-3.5" />
                Improvements
              </p>
              {analysis.improvements.map((item, index) => (
                <p key={`${item}-${index}`} className="mb-1 text-xs text-slate-600">
                  - {item}
                </p>
              ))}
            </div>
          ) : null}

          {analysis.recommendation ? (
            <div className="rounded-xl border border-orange-100 bg-gradient-to-r from-orange-50 to-violet-50 p-3">
              <p className="mb-1 text-xs font-bold text-slate-700">AI Recommendation</p>
              <p className="text-xs leading-5 text-slate-600">{analysis.recommendation}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {!analysis && !loading ? (
        <p className="py-3 text-center text-xs italic text-slate-400">
          Click Analyze to get OpenAI insights for this post.
        </p>
      ) : null}
    </div>
  );
}
