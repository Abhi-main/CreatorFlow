import { useEffect, useRef } from "react";

const colorMap = {
  red: "bg-rose-500 hover:bg-rose-600",
  orange: "bg-brand-orange hover:brightness-105"
};

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  confirmColor = "red",
  onConfirm,
  onCancel,
  children,
  busy = false
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onCancel?.();
        return;
      }

      if (event.key !== "Tab" || !modalRef.current) return;

      const focusable = modalRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    window.setTimeout(() => modalRef.current?.querySelector("button")?.focus(), 0);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 backdrop-blur-sm">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md animate-[modalPop_180ms_ease-out] rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <h2 className="text-xl font-bold text-slate-950">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
        {children ? <div className="mt-5">{children}</div> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="app-button-secondary py-2.5" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`inline-flex items-center justify-center rounded-2xl px-4 py-2.5 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
              colorMap[confirmColor] || colorMap.red
            }`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
