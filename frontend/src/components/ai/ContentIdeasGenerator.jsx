import { useState } from "react";
import { Calendar, Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/api";

const formatColors = {
  carousel: "bg-blue-100 text-blue-700",
  reel: "bg-pink-100 text-pink-700",
  story: "bg-violet-100 text-violet-700",
  feed: "bg-emerald-100 text-emerald-700"
};

const reachColors = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-500"
};

export default function ContentIdeasGenerator({ accountId }) {
  const [topic, setTopic] = useState("");
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState(null);

  async function generate() {
    if (!topic.trim()) return;
    if (!accountId) {
      toast.error("Select a social account first.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/hashtags/ai/content-ideas", {
        accountId,
        topic,
        count: 5
      });
      setIdeas(response.data?.data?.ideas || []);
    } catch (error) {
      toast.error(error.response?.data?.error || "Unable to generate content ideas.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-card">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-brand-orange to-brand-purple text-white">
          <Lightbulb className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">AI Content Ideas</h3>
          <p className="text-xs text-slate-500">Generate OpenAI-powered post ideas instantly.</p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && generate()}
          placeholder="Enter a niche or topic, e.g. fitness, food, tech"
          className="app-input flex-1"
        />
        <button
          type="button"
          onClick={generate}
          disabled={loading || !topic.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-orange to-brand-purple px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Generating..." : "Get Ideas"}
        </button>
      </div>

      {ideas.length ? (
        <div className="space-y-3">
          {ideas.map((idea, index) => {
            const open = selectedIdea === index;
            return (
              <button
                key={`${idea.title}-${index}`}
                type="button"
                onClick={() => setSelectedIdea(open ? null : index)}
                className="w-full rounded-xl border border-slate-100 p-4 text-left transition hover:border-orange-200 hover:bg-orange-50/50"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h4 className="text-sm font-bold text-slate-900">{idea.title}</h4>
                  <div className="flex shrink-0 gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${formatColors[idea.format] || "bg-slate-100 text-slate-600"}`}>
                      {idea.format}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${reachColors[idea.estimated_reach] || "bg-slate-100 text-slate-600"}`}>
                      {idea.estimated_reach} reach
                    </span>
                  </div>
                </div>
                <p className="mb-2 text-xs leading-5 text-slate-500">{idea.concept}</p>
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <span className="font-bold text-brand-orange">Hook: </span>
                  {idea.hook}
                </div>

                {open ? (
                  <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                    <p className="text-xs italic text-slate-700">"{idea.caption_starter}"</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar className="h-3.5 w-3.5" />
                      Best time: {idea.best_day} at {idea.best_time}
                    </div>
                    {idea.suggested_hashtags?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {idea.suggested_hashtags.map((tag) => (
                          <span key={tag} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-600">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {idea.content_tip ? (
                      <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        Tip: {idea.content_tip}
                      </div>
                    ) : null}
                    <a
                      href={`/schedule?caption=${encodeURIComponent(idea.caption_starter || "")}&format=${encodeURIComponent(idea.format || "feed")}`}
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex w-full justify-center rounded-lg bg-brand-orange py-2 text-xs font-bold text-white"
                    >
                      Create This Post
                    </a>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : !loading ? (
        <div className="py-6 text-center text-slate-400">
          <Lightbulb className="mx-auto mb-2 h-10 w-10 opacity-30" />
          <p className="text-sm">Enter a topic to generate AI content ideas.</p>
        </div>
      ) : null}
    </div>
  );
}
