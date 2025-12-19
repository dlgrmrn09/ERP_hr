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
      className={`bg-[#191e21] text-white px-4 py-2 rounded-lg hover:bg-black transition-colors flex items-center gap-2 cursor-pointer ${className}`}
    >
      <span>{label}</span>
      {icon ? (
        <img
          src={icon}
          alt=""
          aria-hidden="true"
          className="w-5 h-5 filter brightness-0 invert"
        />
      ) : null}
    </button>
  );
}

export default BlackButton;
