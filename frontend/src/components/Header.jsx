import { useEffect, useState } from "react";
import { useLocation, useMatch, useNavigate } from "react-router-dom";
import BackIcon from "../assets/icons8-arrow.svg";
import NotiIcon from "../assets/icons8-notification.svg";
import MoonIcon from "../assets/icons8-moon.svg";
import { useAuth } from "../context/AuthContext.jsx";
import apiClient from "../utils/apiClient";
import Sunicon from "../assets/icons8-sun.svg";

const buildUserInitials = (user) => {
  if (!user) {
    return "?";
  }

  const first = String(user.firstName || "").trim();
  const last = String(user.lastName || "").trim();

  if (first && last) {
    return `${first[0]}${last[0]}`.toUpperCase();
  }

  const [primary, secondary] = `${first} ${last}`
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (primary && secondary) {
    return `${primary[0]}${secondary[0]}`.toUpperCase();
  }

  if (primary) {
    return primary[0].toUpperCase();
  }

  const email = String(user.email || "").trim();
  return email ? email[0].toUpperCase() : "?";
};

const resolveDisplayName = (user) => {
  if (!user) {
    return "Guest";
  }

  const parts = [user.firstName, user.lastName]
    .map((value) => String(value || "").trim())
    .filter((value) => value.length > 0);

  if (parts.length > 0) {
    return parts.join(" ");
  }

  const email = String(user.email || "").trim();
  return email || "Guest";
};

const resolveUserRole = (user) => {
  const role = String(user?.role || user?.roleName || "").trim();
  return role || "User";
};

function Header() {
  const { user } = useAuth();
  const userInitials = buildUserInitials(user);
  const userDisplayName = resolveDisplayName(user);
  const userRole = resolveUserRole(user);
  const userEmail = String(user?.email || "").trim();
  const location = useLocation();
  const navigate = useNavigate();
  const matchBoardRoute = useMatch("/tasks/boards/:boardId");
  const boardIdFromRoute = matchBoardRoute?.params?.boardId;
  const [boardNameCache, setBoardNameCache] = useState({});
  const [loadingBoardId, setLoadingBoardId] = useState("");
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === "undefined") {
      return false;
    }
    return document.body.classList.contains("theme-dark");
  });
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") {
      return stored;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  const rawSegments = location.pathname.split("/").filter(Boolean);
  const boardNameFromState = boardIdFromRoute
    ? String(location.state?.boardName || "").trim()
    : "";

  useEffect(() => {
    const root = document.body;
    if (!root) {
      return;
    }
    root.classList.remove("theme-dark", "theme-light");
    root.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
    localStorage.setItem("theme", theme);
    setIsDark(theme === "dark");
  }, [theme]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }
    const body = document.body;
    const syncFromDom = () => {
      const next = body.classList.contains("theme-dark") ? "dark" : "light";
      setIsDark(next === "dark");
      setTheme((current) => (current === next ? current : next));
    };

    const observer = new MutationObserver(syncFromDom);
    observer.observe(body, { attributes: true, attributeFilter: ["class"] });

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMedia = () => syncFromDom();
    media.addEventListener("change", handleMedia);

    const handleStorage = (event) => {
      if (event.key === "theme") {
        syncFromDom();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      observer.disconnect();
      media.removeEventListener("change", handleMedia);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!boardIdFromRoute) {
      setLoadingBoardId("");
      return;
    }

    if (boardNameCache[boardIdFromRoute] || boardNameFromState) {
      return;
    }

    let isActive = true;
    const controller = new AbortController();
    setLoadingBoardId(boardIdFromRoute);

    const fetchBoardName = async () => {
      try {
        const response = await apiClient.get(`/boards/${boardIdFromRoute}`, {
          signal: controller.signal,
        });
        if (!isActive) {
          return;
        }
        const resolvedName =
          response.data?.board?.name?.trim() || `Самбар ${boardIdFromRoute}`;
        setBoardNameCache((previous) => ({
          ...previous,
          [boardIdFromRoute]: resolvedName,
        }));
      } catch (error) {
        if (!isActive || controller.signal.aborted) {
          return;
        }
        setBoardNameCache((previous) => ({
          ...previous,
          [boardIdFromRoute]: `Самбар ${boardIdFromRoute}`,
        }));
      } finally {
        if (isActive) {
          setLoadingBoardId("");
        }
      }
    };

    fetchBoardName();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [boardIdFromRoute, boardNameCache, boardNameFromState]);

  const resolvedBoardName = boardIdFromRoute
    ? boardNameFromState || boardNameCache[boardIdFromRoute] || ""
    : "";

  const breadcrumbSegments = rawSegments.map((segment, index) => {
    const normalized = segment.replace(/-/g, " ");
    let label = normalized.replace(/\b\w/g, (char) => char.toUpperCase());
    const path = `/${rawSegments.slice(0, index + 1).join("/")}`;

    if (boardIdFromRoute && segment === boardIdFromRoute) {
      if (resolvedBoardName) {
        label = resolvedBoardName;
      } else if (loadingBoardId === boardIdFromRoute) {
        label = "Самбар ачаалж байна...";
      } else {
        label = `Самбар ${boardIdFromRoute}`;
      }
    }

    return { label, path };
  });

  if (breadcrumbSegments.length === 0) {
    breadcrumbSegments.push({ label: "Dashboard", path: "/dashboard" });
  }

  return (
    <header
      className={`sticky top-0 left-0 right-0 z-30 flex items-center justify-between border-b p-4 mb-6 shadow-sm backdrop-blur transition-colors duration-150 ${
        isDark
          ? "bg-slate-900/95 border-slate-700 text-slate-100"
          : "bg-white/95 border-gray-200 text-gray-900"
      }`}
    >
      <div
        className={`flex items-center gap-3 font-medium ${
          isDark ? "text-slate-200" : "text-gray-700"
        }`}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className={`inline-flex rounded-full p-1 transition ${
            isDark
              ? "hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-emerald-400/50"
              : "hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-slate-300"
          }`}
          aria-label="Go back"
        >
          <img
            src={BackIcon}
            alt=""
            className={`transform rotate-180 cursor-pointer ${
              isDark ? "invert" : ""
            }`}
          />
        </button>
        <nav
          className={`flex items-center gap-1 text-sm ${
            isDark ? "text-slate-300" : "text-gray-600"
          }`}
          aria-label="Breadcrumb"
        >
          {breadcrumbSegments.map((crumb, index) => {
            const isLast = index === breadcrumbSegments.length - 1;
            return (
              <span key={crumb.path} className="flex items-center">
                {index > 0 && (
                  <span
                    className={
                      isDark ? "mx-1 text-slate-500" : "mx-1 text-gray-400"
                    }
                  >
                    /
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => !isLast && navigate(crumb.path)}
                  className={
                    isLast
                      ? isDark
                        ? "cursor-default text-slate-100"
                        : "cursor-default text-gray-900"
                      : isDark
                      ? "cursor-pointer text-slate-300 hover:underline"
                      : "cursor-pointer text-gray-600 hover:underline"
                  }
                  aria-current={isLast ? "page" : undefined}
                >
                  {crumb.label}
                </button>
              </span>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center justify-center gap-6">
        <img
          src={NotiIcon}
          alt="Notification"
          className={`w-8 h-8 cursor-pointer ${isDark ? "invert" : ""}`}
        />
        <div className="relative group">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold uppercase cursor-default ${
              isDark
                ? "bg-slate-700 text-slate-100"
                : "bg-slate-200 text-slate-700"
            }`}
            role="img"
            aria-label={userDisplayName}
            title={userDisplayName}
          >
            {userInitials}
          </div>
          <div
            className={`pointer-events-none absolute right-0 top-full z-10 mt-3 w-60 rounded-2xl text-left opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${
              isDark
                ? "bg-slate-900/95 ring-1 ring-slate-700"
                : "bg-white/95 ring-1 ring-slate-200"
            }`}
          >
            <div
              className={`flex flex-col gap-1.5 p-3 text-xs ${
                isDark ? "text-slate-200" : "text-slate-600"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold uppercase ${
                    isDark
                      ? "bg-slate-700 text-slate-100"
                      : "bg-slate-200 text-slate-700"
                  }`}
                  role="img"
                  aria-label={userDisplayName}
                  title={userDisplayName}
                >
                  {userInitials}
                </div>
                <p
                  className={`text-sm font-semibold ${
                    isDark ? "text-slate-100" : "text-slate-800"
                  }`}
                >
                  {userDisplayName}
                </p>
              </div>
              <p
                className={
                  isDark
                    ? "font-medium text-slate-300"
                    : "font-medium text-slate-500"
                }
              >
                {userRole}
              </p>
              <p
                className={
                  isDark ? "truncate text-slate-400" : "truncate text-slate-400"
                }
                title={userEmail}
              >
                {userEmail || "Email Байхгүй "}
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            setTheme((current) => (current === "dark" ? "light" : "dark"))
          }
          className={`flex h-8 w-8 items-center cursor-pointer justify-center rounded-full  ring-1 transition focus:outline-none focus:ring-2 ${
            isDark
              ? " text-slate-100 ring-slate-700 hover:bg-slate-700 hover:text-white focus:ring-emerald-400/60"
              : " text-slate-700 ring-slate-200 hover:bg-slate-200 hover:text-slate-900 focus:ring-slate-300"
          }`}
          aria-label="Toggle dark mode"
          aria-pressed={theme === "dark"}
        >
          <img
            src={isDark ? Sunicon : MoonIcon}
            alt=""
            className={`h-5 w-5 transition-transform duration-300 ease-in-out ${
              isDark ? "invert rotate-180 scale-110" : "rotate-0 scale-100"
            }`}
          />
        </button>
      </div>
    </header>
  );
}

export default Header;
