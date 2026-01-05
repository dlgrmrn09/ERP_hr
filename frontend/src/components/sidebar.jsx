import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import SidebarIcon from "../assets/sidebar.svg";
import DashboardIcon from "../assets/icons8-dashboard.svg";
import TimeIcon from "../assets/icons8-clock.svg";
import EmployeeIcon from "../assets/icons8-employee.svg";
import DocumentIcon from "../assets/icons8-document.svg";
import TaskIcon from "../assets/icons8-tasks.svg";
import LogoutIcon from "../assets/icons8-logout.svg";
import MoneyIcon from "../assets/icons8-money.svg";
import { useAuth } from "../context/AuthContext.jsx";
import apiClient from "../utils/apiClient";
import ArrowIcon from "../assets/icons8-arrow.svg";

const navItems = [
  { label: "Хянах самбар", icon: DashboardIcon, path: "/dashboard" },
  { label: "Цаг бүртгэл", icon: TimeIcon, path: "/time-tracking" },
  { label: "Ажилчид", icon: EmployeeIcon, path: "/employees" },
  { label: "Бичиг баримт", icon: DocumentIcon, path: "/documents" },
  { label: "Ажлын Төлөвлөгөө", icon: TaskIcon, path: "/tasks" },
  { label: "Цалин Бодох", icon: MoneyIcon, path: "/salary-calculation" },
];

const taskSubnavItems = [
  { label: "Нүүр", path: "/tasks" },
  { label: "Самбар", path: "/tasks/boards" },
  { label: " Ажил", path: "/tasks/all-tasks" },
  { label: "Workspaces", path: "/tasks/workspace" },
];

function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === "undefined") {
      return false;
    }
    return document.body.classList.contains("theme-dark");
  });
  const [workspacePreview, setWorkspacePreview] = useState({
    items: [],
    loading: false,
    error: "",
  });
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return window.sessionStorage.getItem("selectedWorkspaceId");
  });
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const isTasksRouteActive = location.pathname.startsWith("/tasks");
  const workspaceDropdownRef = useRef(null);
  const isSubnavActive = (targetPath) => {
    if (targetPath === "/tasks") {
      return location.pathname === "/tasks" || location.pathname === "/tasks/";
    }
    return (
      location.pathname === targetPath ||
      location.pathname.startsWith(`${targetPath}/`)
    );
  };

  const handleNavItemClick = (path) => {
    if (path === "/tasks" && collapsed) {
      setCollapsed(false);
    }
  };

  const toggleSidebar = () => setCollapsed((prev) => !prev);
  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
      navigate("/login", { replace: true });
    }
  };

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const body = document.body;
    const updateTheme = () => {
      setIsDark(body.classList.contains("theme-dark"));
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(body, { attributes: true, attributeFilter: ["class"] });

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMedia = () => updateTheme();
    media.addEventListener("change", handleMedia);

    const handleStorage = (event) => {
      if (event.key === "theme") {
        updateTheme();
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
    if (!isTasksRouteActive) {
      return;
    }

    const controller = new AbortController();

    const fetchWorkspaces = async () => {
      setWorkspacePreview((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const response = await apiClient.get("/workspaces", {
          params: { page: 1, pageSize: 5, sort: "updated_at" },
          signal: controller.signal,
        });
        const items = Array.isArray(response.data?.data)
          ? response.data.data
          : [];
        setWorkspacePreview({ items, loading: false, error: "" });
        setSelectedWorkspaceId((previous) => {
          if (previous !== null) {
            return previous;
          }
          const first = items[0]?.id;
          return typeof first === "undefined" ? null : String(first);
        });
      } catch (error) {
        if (controller.signal.aborted) {
          setWorkspacePreview((prev) => ({ ...prev, loading: false }));
          return;
        }
        setWorkspacePreview((prev) => ({
          ...prev,
          loading: false,
          error:
            error.response?.data?.message ||
            "Workspace мэдээллийг татахад алдаа гарлаа.",
        }));
      }
    };

    fetchWorkspaces();

    return () => {
      controller.abort();
    };
  }, [isTasksRouteActive]);

  useEffect(() => {
    const ids = workspacePreview.items.map((item) => String(item.id));
    if (ids.length === 0) {
      if (selectedWorkspaceId !== null) {
        setSelectedWorkspaceId(null);
      }
      return;
    }

    const storedId =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem("selectedWorkspaceId")
        : null;

    if (storedId && ids.includes(storedId)) {
      if (storedId !== selectedWorkspaceId) {
        setSelectedWorkspaceId(storedId);
      }
      return;
    }

    if (selectedWorkspaceId && ids.includes(selectedWorkspaceId)) {
      return;
    }

    setSelectedWorkspaceId(ids[0]);
  }, [workspacePreview.items, selectedWorkspaceId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (selectedWorkspaceId) {
      window.sessionStorage.setItem("selectedWorkspaceId", selectedWorkspaceId);
    } else {
      window.sessionStorage.removeItem("selectedWorkspaceId");
    }
    window.dispatchEvent(
      new CustomEvent("workspace:selected", {
        detail: selectedWorkspaceId,
      })
    );
  }, [selectedWorkspaceId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleExternalSelection = (event) => {
      const nextValue =
        typeof event.detail === "string" && event.detail !== ""
          ? event.detail
          : null;
      setSelectedWorkspaceId((current) =>
        current === nextValue ? current : nextValue
      );
    };

    window.addEventListener("workspace:selected", handleExternalSelection);
    return () => {
      window.removeEventListener("workspace:selected", handleExternalSelection);
    };
  }, []);

  useEffect(() => {
    if (!isWorkspaceDropdownOpen) {
      return;
    }

    const handleInteraction = (event) => {
      if (
        workspaceDropdownRef.current &&
        !workspaceDropdownRef.current.contains(event.target)
      ) {
        setIsWorkspaceDropdownOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsWorkspaceDropdownOpen(false);
      }
    };

    window.addEventListener("mousedown", handleInteraction);
    window.addEventListener("touchstart", handleInteraction);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleInteraction);

    return () => {
      window.removeEventListener("mousedown", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleInteraction);
    };
  }, [isWorkspaceDropdownOpen]);

  useEffect(() => {
    setIsWorkspaceDropdownOpen(false);
  }, [location.pathname, workspacePreview.items]);

  const selectedWorkspaceName =
    workspacePreview.items.find(
      (item) => String(item.id) === selectedWorkspaceId
    )?.name ?? "Workspace сонгох";

  return (
    <aside
      className={`max-h-dvh flex flex-col shadow-md sticky top-0 left-0 transition-colors duration-150 ${
        collapsed ? "items-center" : ""
      } ${isDark ? "bg-slate-900 text-slate-100" : "bg-white text-slate-900"}`}
      style={{ width: collapsed ? "80px" : "250px" }}
    >
      <div
        className={`flex items-center ${
          collapsed ? "justify-center" : "justify-between"
        } gap-3 p-6 mb-5`}
      >
        <h2
          className={`text-[24px] font-bold ${collapsed ? "hidden" : "block"} ${
            isDark ? "text-slate-100" : "text-slate-900"
          }`}
        >
          Хүний Нөөц
        </h2>
        <button
          type="button"
          onClick={toggleSidebar}
          className="cursor-pointer"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <img
            src={SidebarIcon}
            alt="Хүний Нөөц"
            className={`w-6.5 h-6.5 opacity-[0.6] ${
              isDark ? "filter brightness-0 invert" : ""
            }`}
          />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto flex flex-col justify-between">
        <ul className="p-4 space-y-1">
          {navItems.map((item) => (
            <li key={item.label}>
              <NavLink
                to={item.path}
                onClick={() => handleNavItemClick(item.path)}
                className={({ isActive }) => {
                  const active = isDark
                    ? "bg-slate-800 text-white ring-1 ring-slate-700"
                    : "bg-slate-900 text-white";
                  const idle = isDark
                    ? "text-slate-200 hover:bg-slate-800 hover:text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900";
                  return `w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    collapsed ? "justify-center" : ""
                  } ${isActive ? active : idle}`;
                }}
              >
                {({ isActive }) => (
                  <>
                    <img
                      src={item.icon}
                      alt={item.label}
                      className={`w-6.25 h-6.25 ${
                        isActive
                          ? "filter brightness-0 invert"
                          : isDark
                          ? "invert opacity-80"
                          : ""
                      }`}
                    />
                    <span
                      className={`${
                        collapsed ? "hidden" : "block"
                      } text-[16px] ${
                        isActive
                          ? "text-white opacity-100"
                          : isDark
                          ? "text-slate-100 opacity-80"
                          : "text-black opacity-[0.6]"
                      }`}
                    >
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
              {item.path === "/tasks" && isTasksRouteActive && !collapsed && (
                <div
                  className={`mt-2 ml-6 space-y-3 border-l pl-4 ${
                    isDark ? "border-slate-700" : "border-slate-300"
                  }`}
                >
                  <ul className="space-y-1">
                    {taskSubnavItems.map((subItem) => (
                      <li key={subItem.label}>
                        <Link
                          to={subItem.path}
                          className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm  font-medium transition-all ${
                            isSubnavActive(subItem.path)
                              ? isDark
                                ? "text-slate-100"
                                : "text-black"
                              : isDark
                              ? "opacity-80 text-slate-200 hover:bg-slate-800 hover:text-white"
                              : "opacity-[0.6] text-black hover:bg-slate-100 hover:text-slate-900"
                          }`}
                          aria-current={
                            isSubnavActive(subItem.path) ? "page" : undefined
                          }
                        >
                          {/* <ArrowIcon/> */}
                          <span>{subItem.label}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {isSubnavActive("/tasks/workspace") ? (
                    <section className="bg-transparent">
                      {workspacePreview.loading ? (
                        <p className="mt-3 text-xs text-slate-500">
                          Workspace татаж байна...
                        </p>
                      ) : workspacePreview.error ? (
                        <p className="mt-3 text-xs text-rose-500">
                          {workspacePreview.error}
                        </p>
                      ) : workspacePreview.items.length === 0 ? (
                        <p className="mt-3 text-xs text-slate-500">
                          Workspace олдсонгүй.
                        </p>
                      ) : (
                        <div
                          className="relative mt-3"
                          ref={workspaceDropdownRef}
                        >
                          <button
                            type="button"
                            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-semibold transition focus:outline-none focus:ring-2 ${
                              isDark
                                ? "border-slate-700 bg-slate-800 text-slate-100 hover:border-slate-600 hover:bg-slate-700 focus:border-emerald-400 focus:ring-emerald-400/40"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 focus:border-slate-400 focus:ring-slate-200"
                            }`}
                            onClick={() =>
                              setIsWorkspaceDropdownOpen((prev) => !prev)
                            }
                            aria-haspopup="listbox"
                            aria-expanded={isWorkspaceDropdownOpen}
                          >
                            <span className="truncate">
                              {selectedWorkspaceName}
                            </span>
                            <span
                              className={`ml-2 text-slate-400 transition-transform ${
                                isWorkspaceDropdownOpen ? "rotate-180" : ""
                              }`}
                            >
                              ▾
                            </span>
                          </button>
                          {isWorkspaceDropdownOpen ? (
                            <ul
                              className={`absolute left-0 right-0 z-20 mt-2 max-h-56 overflow-y-auto rounded-lg border py-1 shadow-xl ${
                                isDark
                                  ? "border-slate-700 bg-slate-900"
                                  : "border-slate-200 bg-white"
                              }`}
                              role="listbox"
                            >
                              {workspacePreview.items.map((workspace) => {
                                const value = String(workspace.id);
                                const isSelected =
                                  value === selectedWorkspaceId;
                                return (
                                  <li key={workspace.id}>
                                    <button
                                      type="button"
                                      className={`flex w-full items-center px-3 py-2 text-left text-sm transition ${
                                        isSelected
                                          ? isDark
                                            ? "bg-slate-800 font-semibold text-slate-100"
                                            : "bg-slate-100 font-semibold text-slate-900"
                                          : isDark
                                          ? "text-slate-200 hover:bg-slate-800 hover:text-white"
                                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                      }`}
                                      onClick={() => {
                                        setSelectedWorkspaceId(value);
                                        setIsWorkspaceDropdownOpen(false);
                                      }}
                                      role="option"
                                      aria-selected={isSelected}
                                    >
                                      <span className="truncate">
                                        {workspace.name}
                                      </span>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                        </div>
                      )}
                    </section>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="p-4 space-y-1 border-t border-slate-300">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
              collapsed ? "justify-center" : ""
            } ${
              isDark
                ? "text-slate-200 hover:bg-slate-800 hover:text-white"
                : "text-slate-600 border-gray- hover:bg-slate-100 hover:text-slate-900"
            } ${isLoggingOut ? "opacity-60 cursor-not-allowed" : ""}`}
            aria-disabled={isLoggingOut}
          >
            <img
              src={LogoutIcon}
              alt="Logout"
              className={`w-6.25 h-6.25 opacity-[0.6] ${
                isDark ? "invert" : ""
              }`}
            />
            <span
              className={`opacity-[0.6] text-[16px] ${
                collapsed ? "hidden" : "block"
              } ${isDark ? "text-slate-100" : "text-black"}`}
            >
              Системээс гарах
            </span>
          </button>
        </div>
      </nav>
    </aside>
  );
}

export default Sidebar;
