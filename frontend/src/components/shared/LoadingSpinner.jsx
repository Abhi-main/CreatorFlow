export default function LoadingSpinner({ label = "Loading Smart Social..." }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 animate-bounce rounded-full bg-brand-orange [animation-delay:-0.2s]" />
        <span className="h-3 w-3 animate-bounce rounded-full bg-brand-purple [animation-delay:-0.1s]" />
        <span className="h-3 w-3 animate-bounce rounded-full bg-brand-green" />
      </div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
    </div>
  );
}
