import clsx from "clsx";
import StatCard from "./StatCard";

const badgeTones = {
  draft: "bg-slate-100 text-slate-600",
  scheduled: "bg-violet-100 text-violet-700",
  published: "bg-emerald-100 text-emerald-700",
  active: "bg-emerald-100 text-emerald-700",
  connected: "bg-blue-100 text-blue-700",
  warning: "bg-orange-100 text-orange-700",
  suspended: "bg-rose-100 text-rose-700"
};

export function PageCard({ title, subtitle, actions, children, className }) {
  return (
    <section className={clsx("app-surface p-5 md:p-6", className)}>
      {(title || subtitle || actions) ? (
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            {title ? <h2 className="text-xl font-semibold text-slate-900">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatusBadge({ children }) {
  const normalized = String(children || "").toLowerCase();

  return (
    <span className={clsx("inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize", badgeTones[normalized] || "bg-slate-100 text-slate-600")}>
      {children}
    </span>
  );
}

export function DataTable({ columns, rows, empty = "No records found.", onRowClick }) {
  if (!rows.length) {
    return <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">{empty}</div>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-[0.24em] text-slate-400">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-4 py-3 font-semibold">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row, index) => (
            <tr
              key={row.id || index}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={clsx(index % 2 === 0 ? "bg-white" : "bg-slate-50/40", onRowClick ? "cursor-pointer hover:bg-orange-50/50" : "")}
            >
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-3 text-slate-700">
                  {column.render ? column.render(row, index) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PaginationControls({ pagination, onPageChange }) {
  if (!pagination) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
      <p>
        Page {pagination.page} of {pagination.totalPages} - {pagination.total} total
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className="app-button-secondary py-2"
          disabled={pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="app-button-secondary py-2"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export { StatCard };
