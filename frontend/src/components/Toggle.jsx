const sizeMap = {
  sm: { track: "h-6 w-11", thumb: "h-5 w-5", translate: "translate-x-5" },
  md: { track: "h-7 w-14", thumb: "h-6 w-6", translate: "translate-x-7" },
  lg: { track: "h-8 w-16", thumb: "h-7 w-7", translate: "translate-x-8" }
};

export default function Toggle({ checked, onChange, disabled = false, size = "md" }) {
  const sizing = sizeMap[size] || sizeMap.md;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`relative inline-flex ${sizing.track} items-center rounded-full p-0.5 transition duration-200 ${
        checked ? "bg-brand-orange" : "bg-slate-300"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      onClick={() => !disabled && onChange?.(!checked)}
    >
      <span
        className={`${sizing.thumb} rounded-full bg-white shadow-md transition duration-200 ${
          checked ? sizing.translate : "translate-x-0"
        }`}
      />
    </button>
  );
}
