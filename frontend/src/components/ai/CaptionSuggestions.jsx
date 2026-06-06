import { useState } from "react";
import { Check, Copy, RefreshCw, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/api";

const tones = [
  { value: "casual", label: "Casual", color: "bg-blue-100 text-blue-700" },
  { value: "professional", label: "Professional", color: "bg-slate-100 text-slate-700" },
  { value: "humorous", label: "Humorous", color: "bg-amber-100 text-amber-700" },
  { value: "inspirational", label: "Inspirational", color: "bg-violet-100 text-violet-700" },
  { value: "promotional", label: "Promotional", color: "bg-orange-100 text-orange-700" }
];

export default function CaptionSuggestions({
  postId,
  platform,
  existingCaption,
  mediaType = "image",
  mediaIds = [],
  mediaUrls = [],
  onUse
}) {
  const [tone, setTone] = useState("casual");
  const [captions, setCaptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  async function generate() {
    setLoading(true);
    try {
      const response = await api.post("/hashtags/captions/suggestions", {
        postId,
        tone,
        platform,
        mediaType,
        existingCaption,
        mediaIds,
        mediaUrls
      });
      setCaptions(response.data?.data || []);
    } catch (error) {
      toast.error(error.response?.data?.error || "Unable to generate captions.");
    } finally {
      setLoading(false);
    }
  }

  async function copy(text, index) {
    await navigator.clipboard.writeText(text);
    setCopied(index);
    window.setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="rounded-2xl border-2 border-orange-200 bg-orange-50/80 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand-orange" />
        <span className="text-sm font-bold text-orange-700">AI Caption Suggestions</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {tones.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTone(item.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              tone === item.value ? `${item.color} ring-2 ring-brand-orange ring-offset-1` : "border border-slate-200 bg-white text-slate-500"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? "Generating..." : "Generate Captions"}
      </button>

      {captions.length ? (
        <div className="space-y-3">
          {captions.map((caption, index) => {
            const text = caption.text || caption.suggestion || caption;
            return (
              <div key={`${tone}-${index}`} className="rounded-xl border border-orange-100 bg-white p-3">
                <div className="mb-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold capitalize text-orange-700">
                    {caption.tone || tone}
                  </span>
                  {caption.estimated_engagement ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold capitalize text-emerald-700">
                      {caption.estimated_engagement} engagement
                    </span>
                  ) : null}
                </div>
                <p className="mb-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{text}</p>
                {caption.cta ? <p className="mb-2 text-xs italic text-slate-400">CTA: {caption.cta}</p> : null}
                <div className="flex gap-2">
                  <button type="button" onClick={() => onUse?.(text)} className="flex-1 rounded-lg bg-brand-orange py-2 text-xs font-bold text-white">
                    Use This
                  </button>
                  <button
                    type="button"
                    onClick={() => copy(text, index)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"
                  >
                    {copied === index ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    {copied === index ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
