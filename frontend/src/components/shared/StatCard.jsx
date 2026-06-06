import { memo } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

const toneMap = {
  orange: "bg-orange-50 text-brand-orange",
  purple: "bg-violet-50 text-brand-purple",
  green: "bg-emerald-50 text-brand-green",
  blue: "bg-blue-50 text-blue-500",
  cyan: "bg-cyan-50 text-cyan-500",
  red: "bg-rose-50 text-rose-500",
  grey: "bg-slate-100 text-slate-500"
};

function StatCardComponent({ title, value, change, icon: Icon, color = "orange" }) {
  const positive = !String(change || "").trim().startsWith("-");

  return (
    <div className="app-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
        </div>
        <div className={`grid h-12 w-12 place-items-center rounded-2xl ${toneMap[color] || toneMap.orange}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
        {positive ? <TrendingUp className="h-3.5 w-3.5 text-brand-green" /> : <TrendingDown className="h-3.5 w-3.5 text-rose-500" />}
        <span className={positive ? "text-brand-green" : "text-rose-500"}>{change}</span>
      </div>
    </div>
  );
}

const StatCard = memo(StatCardComponent);

export default StatCard;
