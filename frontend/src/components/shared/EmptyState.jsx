import { Inbox } from "lucide-react";

export default function EmptyState({ title, description, action }) {
  return (
    <div className="app-surface flex flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-orange-50 text-brand-orange">
        <Inbox className="h-8 w-8" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}
