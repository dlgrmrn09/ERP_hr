import { useLocation, useNavigate } from "react-router-dom";
import BackIcon from "../assets/icons8-arrow.svg";
import NotiIcon from "../assets/icons8-notification.svg";
import MoonIcon from "../assets/icons8-moon.svg";
import AdminIcon from "../assets/icons8-administrator-male.svg";

function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const segments = location.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/-/g, " "));

  const breadcrumb = segments.length
    ? segments
        .map((segment) => segment[0].toUpperCase() + segment.slice(1))
        .join(" / ")
    : "Dashboard";

  return (
    <header className="flex items-center justify-between bg-white shadow border-b border-gray-200 p-4 mb-6">
      <div className="flex  items-center gap-3 text-gray-700 font-medium  ">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex"
          aria-label="Go back"
        >
          <img
            src={BackIcon}
            alt=""
            className="transform rotate-180 cursor-pointer"
          />
        </button>
        <span className="cursor-pointer hover:underline">{breadcrumb}</span>
      </div>
      <div className="flex items-center justify-center gap-6">
        <img
          src={NotiIcon}
          alt="Notification"
          className="w-6.25 h-6.25 cursor-pointer"
        />
        <img
          src={AdminIcon}
          alt="Admin"
          className="w-6.25 h-6.25 cursor-pointer"
        />
        <img
          src={MoonIcon}
          alt="Dark Mode"
          className="w-6.25 h-6.25 cursor-pointer"
        />
      </div>
    </header>
  );
}

export default Header;
