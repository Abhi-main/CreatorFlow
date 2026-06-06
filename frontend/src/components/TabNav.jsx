export default function TabNav({ tabs, activeTab, onTabChange }) {
  return (
    <nav className="sticky top-4 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-card lg:block lg:w-64 lg:space-y-2 lg:overflow-visible">
      {tabs.map(({ id, label, icon: Icon }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            className={`flex min-w-max items-center gap-3 rounded-xl border-l-4 px-4 py-3 text-left text-sm font-bold transition lg:w-full ${
              active
                ? "border-brand-orange bg-orange-50 text-brand-orange"
                : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-950"
            }`}
            onClick={() => onTabChange(id)}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
