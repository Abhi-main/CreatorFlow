import { useCallback, useState } from "react";
import { useSocketEvent } from "../hooks/useSocket";
import { EVENTS } from "../socket/events";

function initials(member) {
  const first = member.first_name || member.name?.split(" ")[0] || "";
  const last = member.last_name || member.name?.split(" ")[1] || "";
  return `${first[0] || ""}${last[0] || ""}`.toUpperCase() || "?";
}

export default function OnlineUsers({ teamMembers = [], collapsed = false }) {
  const [onlineIds, setOnlineIds] = useState([]);

  useSocketEvent(
    EVENTS.USERS_ONLINE,
    useCallback((ids) => {
      setOnlineIds((ids || []).map(String));
    }, [])
  );

  const onlineMembers = teamMembers.filter((member) => onlineIds.includes(String(member.user_id || member.id)));

  if (!onlineMembers.length) return null;

  return (
    <div className="border-t border-slate-100 px-3 py-3">
      {!collapsed ? (
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Online Now</p>
      ) : null}
      <div className={`flex flex-wrap gap-1.5 ${collapsed ? "justify-center" : ""}`}>
        {onlineMembers.slice(0, collapsed ? 2 : 8).map((member) => (
          <div key={member.user_id || member.id} className="relative" title={member.full_name || member.name || member.email}>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand-orange to-brand-purple text-xs font-bold text-white">
              {initials(member)}
            </div>
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-green" />
          </div>
        ))}
      </div>
    </div>
  );
}
