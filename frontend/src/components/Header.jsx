import { useEffect, useState } from "react";
import { useLocation, useMatch, useNavigate } from "react-router-dom";
import BackIcon from "../assets/icons8-arrow.svg";
import NotiIcon from "../assets/icons8-notification.svg";
import MoonIcon from "../assets/icons8-moon.svg";
import { useAuth } from "../context/AuthContext.jsx";
import apiClient from "../utils/apiClient";

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
  const rawSegments = location.pathname.split("/").filter(Boolean);
  const boardNameFromState = boardIdFromRoute
    ? String(location.state?.boardName || "").trim()
    : "";

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
    <header className=" flex items-center justify-between bg-white shadow-sm   border-b border-gray-200 p-4 mb-6">
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
        <nav
          className="flex items-center gap-1 text-sm text-gray-600"
          aria-label="Breadcrumb"
        >
          {breadcrumbSegments.map((crumb, index) => {
            const isLast = index === breadcrumbSegments.length - 1;
            return (
              <span key={crumb.path} className="flex items-center">
                {index > 0 && <span className="mx-1 text-gray-400">/</span>}
                <button
                  type="button"
                  onClick={() => !isLast && navigate(crumb.path)}
                  className={
                    isLast
                      ? "cursor-default text-gray-900"
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
          className="w-6.25 h-6.25 cursor-pointer"
        />
        <div className="relative group">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold uppercase text-slate-700 cursor-default"
            role="img"
            aria-label={userDisplayName}
            title={userDisplayName}
          >
            {userInitials}
          </div>
          <div className="pointer-events-none absolute right-0 top-full z-10 mt-3 w-60 rounded-2xl bg-white/95 text-left opacity-0 shadow-xl ring-1 ring-slate-200 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
            <div className="flex flex-col gap-1.5 p-3 text-xs text-slate-600">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold uppercase text-slate-700"
                  role="img"
                  aria-label={userDisplayName}
                  title={userDisplayName}
                >
                  {userInitials}
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {userDisplayName}
                </p>
              </div>
              <p className="font-medium text-slate-500">{userRole}</p>
              <p className="truncate text-slate-400" title={userEmail}>
                {userEmail || "Email not set"}
              </p>
            </div>
          </div>
        </div>
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
