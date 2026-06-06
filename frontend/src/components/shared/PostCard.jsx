import { memo } from "react";
import { CalendarClock } from "lucide-react";

function PostCardComponent({ platformLabel, caption, scheduledAt, icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-orange-50 text-brand-orange">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-semibold text-slate-900">{platformLabel}</p>
            <div className="inline-flex items-center gap-1 text-xs text-slate-400">
              <CalendarClock className="h-3.5 w-3.5" />
              {scheduledAt}
            </div>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-slate-500">{caption}</p>
        </div>
      </div>
    </div>
  );
}

const PostCard = memo(PostCardComponent);

export default PostCard;
