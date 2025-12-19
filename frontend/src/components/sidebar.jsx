import { useState } from "react";
import { NavLink } from "react-router-dom";
import SidebarIcon from "../assets/sidebar.svg";
import DashboardIcon from "../assets/icons8-dashboard.svg";
import TimeIcon from "../assets/icons8-clock.svg";
import EmployeeIcon from "../assets/icons8-employee.svg";
import DocumentIcon from "../assets/icons8-document.svg";
import TaskIcon from "../assets/icons8-tasks.svg";
import LogoutIcon from "../assets/icons8-logout.svg";

const navItems = [
  { label: "Dashboard", icon: DashboardIcon, path: "/dashboard" },
  { label: "Цаг бүртгэл", icon: TimeIcon, path: "/time-tracking" },
  { label: "Ажилчид", icon: EmployeeIcon, path: "/employees" },
  { label: "Бичиг баримт", icon: DocumentIcon, path: "/documents" },
  { label: "Даалгавар", icon: TaskIcon, path: "/tasks" },
];

function Sidebar() {
  const [collapsed, setCollapsed] = useState(true);

  const toggleSidebar = () => setCollapsed((prev) => !prev);

  return (
    <aside
      className={`min-h-dvh bg-white flex flex-col shadow-md ${
        collapsed ? "items-center" : ""
      }`}
      style={{ width: collapsed ? "80px" : "300px" }}
    >
      <div
        className={`flex items-center ${
          collapsed ? "justify-center" : "justify-between"
        } gap-3 p-6 mb-5`}
      >
        <h2
          className={`text-[28px]  text-slate-900 font-bold ${
            collapsed ? "hidden" : "block"
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
            className="w-6.5 h-6.5 opacity-[0.6]"
          />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto flex flex-col justify-between">
        <ul className="p-4 space-y-1">
          {navItems.map((item) => (
            <li key={item.label}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    collapsed ? "justify-center" : ""
                  } ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <img
                      src={item.icon}
                      alt={item.label}
                      className={`w-6.25 h-6.25 ${
                        isActive ? "filter brightness-0 invert" : ""
                      }`}
                    />
                    <span
                      className={`${
                        collapsed ? "hidden" : "block"
                      } text-[16px] ${
                        isActive
                          ? "text-white opacity-100"
                          : "text-black opacity-[0.6]"
                      }`}
                    >
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="p-4 space-y-1 border-t border-slate-300">
          <button
            type="button"
            className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <img
              src={LogoutIcon}
              alt="Logout"
              className="w-6.25 h-6.25 opacity-[0.6]"
            />
            <span
              className={`opacity-[0.6] text-black text-[16px] ${
                collapsed ? "hidden" : "block"
              }`}
            >
              Logout
            </span>
          </button>
        </div>
      </nav>
    </aside>
  );
}

export default Sidebar;
