function WhiteButton({
  label,
  icon,
  onClick,
  className = "",
  type = "button",
  ariaLabel,
  isSelected,
  iconPosition = "trailing",
  disabled = false,
  children,
}) {
  const iconMarkup = icon ? (
    <img src={icon} alt="" aria-hidden="true" className="h-4 w-4" />
  ) : null;

  const selected = Boolean(isSelected);

  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
        selected
          ? "border-slate-900 bg-slate-900 text-white shadow-[0_10px_25px_rgba(15,23,42,0.18)]"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""} ${className}`}
      aria-label={ariaLabel || (typeof label === "string" ? label : undefined)}
      aria-pressed={typeof isSelected === "undefined" ? undefined : selected}
      disabled={disabled}
    >
      {iconMarkup && iconPosition === "leading" ? iconMarkup : null}
      {label ? <span className="whitespace-nowrap">{label}</span> : null}
      {children}
      {iconMarkup && iconPosition === "trailing" ? iconMarkup : null}
    </button>
  );
}

export default WhiteButton;
