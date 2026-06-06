import { format, formatDistanceToNow } from "date-fns";

export function formatNumber(value) {
  const number = Number(value || 0);

  if (Math.abs(number) >= 1_000_000) {
    return `${(number / 1_000_000).toFixed(number % 1_000_000 === 0 ? 0 : 1)}M`;
  }

  if (Math.abs(number) >= 1_000) {
    return `${(number / 1_000).toFixed(number % 1_000 === 0 ? 0 : 1)}K`;
  }

  return String(number);
}

export function formatDate(dateStr) {
  if (!dateStr) return "-";
  return format(new Date(dateStr), "MMM d, yyyy · h:mm a");
}

export function formatRelative(dateStr) {
  if (!dateStr) return "-";
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
}

export function getStatusColor(status) {
  const normalized = String(status || "").toLowerCase();
  const colors = {
    draft: "bg-slate-100 text-slate-700 border-slate-200",
    scheduled: "bg-orange-100 text-orange-700 border-orange-200",
    published: "bg-emerald-100 text-emerald-700 border-emerald-200",
    failed: "bg-rose-100 text-rose-700 border-rose-200",
    cancelled: "bg-slate-200 text-slate-700 border-slate-300",
    active: "bg-emerald-100 text-emerald-700 border-emerald-200",
    paused: "bg-yellow-100 text-yellow-700 border-yellow-200",
    completed: "bg-blue-100 text-blue-700 border-blue-200",
    archived: "bg-slate-200 text-slate-700 border-slate-300"
  };

  return colors[normalized] || colors.draft;
}

export function getPlatformColor(platform) {
  const normalized = String(platform?.slug || platform?.name || platform || "").toLowerCase();

  if (normalized.includes("instagram")) return "#FF4081";
  if (normalized.includes("facebook")) return "#1877F2";
  if (normalized.includes("linkedin")) return "#0A66C2";

  return "#7C4DFF";
}

export function hashColor(str) {
  const colors = ["#F5A623", "#7C4DFF", "#00C896", "#FF4081", "#3B82F6", "#14B8A6"];
  const input = String(str || "");
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = input.charCodeAt(index) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}
