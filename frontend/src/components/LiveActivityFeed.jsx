import { useCallback, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useSocketEvent } from "../hooks/useSocket";
import { EVENTS } from "../socket/events";

export default function LiveActivityFeed() {
  const [activities, setActivities] = useState([]);

  const addActivity = useCallback((type, data) => {
    setActivities((current) =>
      [
        {
          id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          type,
          data,
          time: new Date()
        },
        ...current
      ].slice(0, 10)
    );
  }, []);

  useSocketEvent(EVENTS.POST_CREATED, useCallback((data) => addActivity("created", data), [addActivity]));
  useSocketEvent(EVENTS.POST_PUBLISHED, useCallback((data) => addActivity("published", data), [addActivity]));
  useSocketEvent(EVENTS.POST_DELETED, useCallback((data) => addActivity("deleted", data), [addActivity]));
  useSocketEvent(EVENTS.POST_FAILED, useCallback((data) => addActivity("failed", data), [addActivity]));
  useSocketEvent(EVENTS.FOLLOWERS_UPDATED, useCallback((data) => addActivity("followers", data), [addActivity]));

  const meta = {
    created: { icon: "N", label: "New post created", classes: "bg-blue-50 text-blue-600" },
    published: { icon: "P", label: "Post went live", classes: "bg-emerald-50 text-emerald-600" },
    deleted: { icon: "D", label: "Post deleted", classes: "bg-rose-50 text-rose-600" },
    failed: { icon: "F", label: "Post failed", classes: "bg-rose-50 text-rose-600" },
    followers: { icon: "G", label: "Followers updated", classes: "bg-violet-50 text-brand-purple" }
  };

  if (!activities.length) {
    return (
      <div className="grid place-items-center py-8 text-center text-slate-400">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-50 text-brand-orange">Live</div>
        <p className="mt-3 text-sm">Live activity will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activities.map((activity) => {
        const item = meta[activity.type] || meta.created;
        return (
          <div key={activity.id} className={`flex items-center gap-3 rounded-2xl p-3 ${item.classes}`}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/80 text-xs font-black">{item.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{item.label}</p>
              <p className="text-xs opacity-70">{formatDistanceToNow(activity.time, { addSuffix: true })}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
