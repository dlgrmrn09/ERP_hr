import SearchIcon from "../assets/icons8-search.svg";

function Searchbar({
  placeholder = "",
  value,
  onChange,
  className = "",
  inputProps = {},
  isDark = false,
}) {
  return (
    <div
      className={`relative flex items-center rounded-2xl border shadow-sm focus-within:ring-2 ${
        isDark
          ? "border-slate-700 bg-slate-900/80 text-slate-200 focus-within:border-slate-500 focus-within:ring-slate-700"
          : "border-gray-200 bg-white text-gray-900 focus-within:border-gray-400 focus-within:ring-gray-200"
      } ${className}`}
    >
      <img
        src={SearchIcon}
        alt=""
        aria-hidden="true"
        className={`absolute left-4 h-5 w-5 opacity-70 ${
          isDark ? "invert  " : ""
        }`}
      />
      <input
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder ? ` ${placeholder} хайх...` : "Search..."}
        className={`w-full rounded-2xl bg-transparent py-3 pl-12 pr-4 text-sm focus:outline-none ${
          isDark
            ? "text-slate-100 placeholder:text-slate-500"
            : "text-gray-900 placeholder:text-gray-500"
        }`}
        {...inputProps}
      />
    </div>
  );
}

export default Searchbar;
