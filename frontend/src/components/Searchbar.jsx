import SearchIcon from "../assets/icons8-search.svg";

function Searchbar({
  placeholder = "",
  value,
  onChange,
  className = "",
  inputProps = {},
}) {
  return (
    <div
      className={`relative flex items-center bg-white rounded-2xl border border-gray-200 shadow-sm focus-within:border-gray-400 focus-within:ring-2 focus-within:ring-gray-200 ${className}`}
    >
      <img
        src={SearchIcon}
        alt=""
        aria-hidden="true"
        className="absolute left-4 h-5 w-5 opacity-70"
      />
      <input
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder ? `Search ${placeholder}...` : "Search..."}
        className="w-full rounded-2xl bg-transparent py-3 pl-12 pr-4 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
        {...inputProps}
      />
    </div>
  );
}

export default Searchbar;
