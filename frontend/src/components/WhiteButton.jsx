function BlackButton({
  label,
  icon,
  onClick,
  className = "",
  type = "button",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`bg-white text-[#191e21] px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors flex items-center gap-2 cursor-pointer ${className}`}
    >
      <span>{label}</span>
      {icon ? (
        <img src={icon} alt="" aria-hidden="true" className="w-5 h-5 " />
      ) : null}
    </button>
  );
}

export default BlackButton;
