import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProfileModal from "../components/Profile.jsx";
import apiClient from "../utils/apiClient";
import Searchbar from "../components/Searchbar.jsx";
import WhiteButton from "../components/WhiteButton.jsx";

const API_PAGE_SIZE = 500;
const DEFAULT_PAGE_SIZE = 12;
const PAGE_SIZE_OPTIONS = [12, 24, 48];
const SORT_DIRECTION_LABELS = { asc: "Өсөх", desc: "Буурах" };

const composeFullName = ({
  first_name: firstName,
  last_name: lastName,
  employee_code: code,
}) => {
  const parts = [lastName, firstName].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }
  return code || "Нэр тодорхойгүй";
};



const formatContact = (value) =>
  value && value.trim() !== "" ? value : "Мэдээлэл байхгүй";

const sortLabels = (values) =>
  Array.from(values)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "mn-MN", { sensitivity: "base" }));

const buildInitials = ({
  first_name: firstName,
  last_name: lastName,
  employee_code: code,
}) => {
  const trimmedFirst = (firstName ?? "").trim();
  const trimmedLast = (lastName ?? "").trim();
  const firstInitial = trimmedFirst ? trimmedFirst[0].toUpperCase() : "";
  const lastInitial = trimmedLast ? trimmedLast[0].toUpperCase() : "";
  if (firstInitial && lastInitial) {
    return `${firstInitial}${lastInitial}`;
  }
  if (firstInitial) {
    return firstInitial;
  }
  if (lastInitial) {
    return lastInitial;
  }
  const fallback = (code ?? "").trim();
  return fallback ? fallback[0].toUpperCase() : "?";
};

const AVATAR_COLORS = [
  { bg: "#DBEAFE", fg: "#1E40AF" },
  { bg: "#DCFCE7", fg: "#166534" },
  { bg: "#FEE2E2", fg: "#991B1B" },
  { bg: "#F3E8FF", fg: "#6B21A8" },
  { bg: "#FFF7ED", fg: "#9A3412" },
  { bg: "#E0E7FF", fg: "#4338CA" },
  { bg: "#FEF2F2", fg: "#B91C1C" },
  { bg: "#ECFDF5", fg: "#047857" },
];

const hashString = (value) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
};

const selectAvatarColors = (employee) => {
  const source = [
    employee.first_name,
    employee.last_name,
    employee.employee_code,
    employee.id,
  ]
    .filter(Boolean)
    .join("");

  if (!source) {
    return AVATAR_COLORS[0];
  }

  const index = Math.abs(hashString(String(source))) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
};

const SORT_FIELDS = [
  { value: "first_name", label: "Нэрээр" },
  { value: "employment_status", label: "Статусаар" },
  { value: "start_date", label: "Эхэлсэн он сараар" },
  { value: "created_at", label: "Ажилд орсон огноо" },
];

const MAX_CV_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const FORM_INITIAL_STATE = {
  employeeCode: "",
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  positionTitle: "",
  employmentStatus: "",
  gender: "",
  age: "",
  startDate: new Date().toISOString().slice(0, 10),
  photoUrl: "",
  photoFile: null,
  cvUrl: "",
  cvFile: null,
};

const GENDER_OPTIONS = [
  { value: "Эр", label: "Эр" },
  { value: "Эм", label: "Эм" },
];

const REQUIRED_FIELDS = {
  employeeCode: "Ажилтны код",
  firstName: "Нэр",
  lastName: "Овог",
  email: "Имэйл",
  positionTitle: "Албан тушаал",
  employmentStatus: "Ажил эрхлэлт",
};

const normalizeEmployeeForForm = (employee) => ({
  employeeCode: employee.employee_code ?? "",
  firstName: employee.first_name ?? "",
  lastName: employee.last_name ?? "",
  email: employee.email ?? "",
  phoneNumber: employee.phone_number ?? "",
  positionTitle: employee.position_title ?? "",
  employmentStatus: employee.employment_status ?? "",
  gender: employee.gender ?? "",
  age:
    typeof employee.age === "number" && Number.isFinite(employee.age)
      ? String(employee.age)
      : "",
  startDate: employee.start_date ? employee.start_date.slice(0, 10) : "",
  photoUrl: employee.photo_url ?? "",
  photoFile: null,
  cvUrl: employee.cv_url ?? "",
  cvFile: null,
});

const buildEmployeePayload = (values = FORM_INITIAL_STATE) => ({
  employeeCode: values?.employeeCode?.trim?.() || "",
  firstName: values?.firstName?.trim?.() || "",
  lastName: values?.lastName?.trim?.() || "",
  email: values?.email?.trim?.().toLowerCase() || "",
  phoneNumber: values?.phoneNumber?.trim?.() || "",
  positionTitle: values?.positionTitle?.trim?.() || "",
  employmentStatus: values?.employmentStatus?.trim?.() || "",
  gender: values?.gender?.trim?.() || "",
  age:
    typeof values?.age === "undefined" || values?.age === ""
      ? null
      : values?.age?.toString?.().trim?.(),
  startDate: values?.startDate || null,
  cvUrl: values?.cvUrl?.trim?.() || "",
});

const resolveFileUrl = (url) => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;

  const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
  const backendBase = apiBase.replace(/\/api\/?$/, "");
  const normalized = url.startsWith("/")
    ? url
    : url.startsWith("uploads")
    ? `/${url}`
    : `/uploads/${url}`;

  return `${backendBase}${normalized}`;
};

const toSearchString = (employee) =>
  Object.values(employee)
    .flatMap((value) => {
      if (value === null || typeof value === "undefined") {
        return [];
      }
      if (typeof value === "string") {
        return value;
      }
      if (typeof value === "number") {
        return value.toString();
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      return String(value);
    })
    .join(" ")
    .toLowerCase();

const createPageList = (current, total) => {
  // Return a list of pages plus ellipsis markers for large page counts.
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => ({
      type: "page",
      value: index + 1,
    }));
  }

  const windowPages = [current - 1, current, current + 1].filter(
    (page) => page >= 1 && page <= total
  );

  const basePages = new Set([1, 2, total - 1, total, ...windowPages]);
  const sortedPages = Array.from(basePages).sort((a, b) => a - b);

  const items = [];
  for (let i = 0; i < sortedPages.length; i += 1) {
    const page = sortedPages[i];
    const prev = sortedPages[i - 1];
    if (i > 0 && page - prev > 1) {
      items.push({ type: "ellipsis", value: `ellipsis-${page}` });
    }
    items.push({ type: "page", value: page });
  }

  return items;
};

function FilterSelect({
  label,
  placeholder,
  value,
  onChange,
  options,
  className = "",
  allowEmpty = true,
  uppercaseLabel = true,
  isDark = false,
}) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [openMenu, setOpenMenu] = useState(false);

  const activeOption = options.find((option) => option.value === value);
  const displayLabel = activeOption?.label || placeholder || "Сонгох";
  const isPlaceholder = !activeOption && allowEmpty && Boolean(placeholder);

  useEffect(() => {
    if (!openMenu) {
      return undefined;
    }
    const handleClickOutside = (event) => {
      if (
        triggerRef.current?.contains(event.target) ||
        menuRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpenMenu(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpenMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenu]);

  const handleSelect = (nextValue) => {
    onChange({ target: { value: nextValue } });
    setOpenMenu(false);
  };

  return (
    <label
      className={`flex flex-col gap-2 text-xs font-semibold ${
        uppercaseLabel ? "uppercase tracking-wide" : ""
      } ${isDark ? "text-slate-300" : "text-slate-500"} ${className}`}
    >
      <span>{label}</span>
      <div className="relative w-full">
        <button
          type="button"
          ref={triggerRef}
          onClick={() => setOpenMenu((previous) => !previous)}
          className={`flex h-12 w-full items-center justify-between rounded-2xl px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 ${
            isDark
              ? "border border-slate-700 bg-slate-900 text-slate-100 focus:ring-slate-700 hover:border-slate-500"
              : "border border-slate-200 bg-white text-slate-700 focus:ring-sky-100 hover:border-sky-300"
          } ${
            openMenu ? (isDark ? "border-slate-500" : "border-sky-400") : ""
          }`}
          aria-haspopup="listbox"
          aria-expanded={openMenu}
        >
          <span
            className={`truncate ${
              isPlaceholder
                ? isDark
                  ? "text-slate-500 font-medium"
                  : "text-slate-400 font-medium"
                : isDark
                ? "text-slate-100"
                : "text-slate-700"
            }`}
          >
            {displayLabel}
          </span>
          <span
            className={`ml-3 inline-flex items-center ${
              isDark ? "text-slate-400" : "text-slate-400"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className={`h-4 w-4 transition-transform ${
                openMenu ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            >
              <path
                d="M6 8l4 4 4-4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>

        {openMenu ? (
          <div
            ref={menuRef}
            className={`absolute left-0 right-0 top-[calc(100%+8px)] z-10 rounded-2xl border py-1 shadow-[0_20px_40px_rgba(15,23,42,0.14)] ${
              isDark
                ? "border-slate-700 bg-slate-900 text-slate-100"
                : "border-slate-200 bg-white"
            }`}
          >
            <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
              {allowEmpty && placeholder ? (
                <li>
                  <button
                    type="button"
                    onClick={() => handleSelect("")}
                    className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm font-medium transition ${
                      isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"
                    } ${
                      value === ""
                        ? "text-sky-500"
                        : isDark
                        ? "text-slate-200"
                        : "text-slate-600"
                    }`}
                    role="option"
                    aria-selected={value === ""}
                  >
                    {placeholder}
                    {value === "" ? (
                      <span className="text-xs font-semibold uppercase tracking-wide text-sky-500"></span>
                    ) : null}
                  </button>
                </li>
              ) : null}
              {options.map((option) => {
                const isActive = option.value === value;
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      onClick={() => handleSelect(option.value)}
                      className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm font-medium transition ${
                        isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"
                      } ${
                        isActive
                          ? "text-sky-500"
                          : isDark
                          ? "text-slate-200"
                          : "text-slate-600"
                      }`}
                      role="option"
                      aria-selected={isActive}
                    >
                      {option.label}
                      {isActive ? (
                        <span className="text-xs font-semibold uppercase tracking-wide text-sky-500"></span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </label>
  );
}

function SortDirectionToggle({ value, onChange, isDark = false }) {
  return (
    <fieldset
      className={`flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide ${
        isDark ? "text-slate-300" : "text-slate-500"
      }`}
    >
      <div
        className={`mt-6 inline-flex w-full items-center justify-between gap-2 rounded-2xl p-1 ${
          isDark
            ? "border border-slate-700 bg-slate-900"
            : "border border-slate-200 bg-slate-50"
        }`}
      >
        {["asc", "desc"].map((direction) => {
          const isActive = value === direction;
          return (
            <button
              type="button"
              key={direction}
              onClick={() => onChange(direction)}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 ${
                isActive
                  ? isDark
                    ? "bg-slate-700 text-white shadow-[0_12px_20px_rgba(15,23,42,0.3)]"
                    : "bg-[#191e21] text-white shadow-[0_12px_20px_rgba(14,116,144,0.2)]"
                  : isDark
                  ? "text-slate-200 hover:bg-slate-800"
                  : "text-slate-600 hover:bg-white"
              } ${
                isDark
                  ? "focus-visible:ring-slate-700"
                  : "focus-visible:ring-sky-200"
              }`}
              aria-pressed={isActive}
            >
              {SORT_DIRECTION_LABELS[direction]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function PaginationControls({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  isDark = false,
}) {
  if (totalPages <= 1) {
    return null;
  }

  const pageItems = createPageList(page, totalPages);

  return (
    <nav
      className={`mt-10 flex flex-col gap-4 rounded-3xl px-4 py-3 text-sm shadow-md sm:flex-row sm:items-center sm:justify-between ${
        isDark
          ? "border border-slate-700 bg-slate-900/80 text-slate-200 shadow-slate-900/30"
          : "bg-white/60 text-slate-600"
      }`}
      aria-label="Хуудаслалт"
    >
      <div className="flex items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
            isDark ? "bg-slate-800 text-white" : "bg-[#191e21] text-white"
          }`}
        >
          Нийт: {totalItems}
        </span>
        <FilterSelect
          label="Хуудасны хэмжээ"
          placeholder=""
          value={String(pageSize)}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          options={PAGE_SIZE_OPTIONS.map((size) => ({
            value: String(size),
            label: `${size} / хуудас`,
          }))}
          allowEmpty={false}
          className="!text-[11px] !font-semibold"
          uppercaseLabel={false}
          isDark={isDark}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className={`inline-flex h-10 items-center justify-center rounded-full px-4 font-semibold transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed ${
            isDark
              ? "border border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500 focus:ring-slate-700 disabled:border-slate-800 disabled:text-slate-600"
              : "border border-slate-200 bg-white text-slate-600 hover:border-[#191e21] focus:ring-sky-100 disabled:border-slate-200 disabled:text-slate-300"
          }`}
          disabled={page === 1}
        >
          {`<`}
        </button>
        <div className="flex items-center gap-1">
          {pageItems.map((item) => {
            if (item.type === "ellipsis") {
              return (
                <span
                  key={item.value}
                  className="px-2 text-sm font-semibold text-slate-400"
                  aria-hidden="true"
                >
                  …
                </span>
              );
            }

            const isActive = item.value === page;
            return (
              <button
                type="button"
                key={item.value}
                onClick={() => onPageChange(item.value)}
                className={`h-10 min-w-10 rounded-full border px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 ${
                  isActive
                    ? isDark
                      ? "border-slate-600 bg-slate-700 text-white shadow-[0_12px_20px_rgba(15,23,42,0.25)] focus:ring-slate-700"
                      : "bg-[#191e21] text-white shadow-[0_12px_20px_rgba(14,116,144,0.18)] focus:ring-sky-100"
                    : isDark
                    ? "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500 hover:text-white focus:ring-slate-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-sky-400 hover:text-sky-600 focus:ring-sky-100"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.value}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className={`inline-flex h-10 items-center justify-center rounded-full px-4 font-semibold transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed ${
            isDark
              ? "border border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500 focus:ring-slate-700 disabled:border-slate-800 disabled:text-slate-600"
              : "border border-slate-200 bg-white text-slate-600 hover:border-[#191e21] focus:ring-sky-100 disabled:border-slate-200 disabled:text-slate-300"
          }`}
          disabled={page === totalPages}
        >
          {`>`}
        </button>
      </div>
    </nav>
  );
}

function EmployeeCard({
  employee,
  onEdit,
  onDelete,
  onView,
  isDeleting,
  isDark = false,
}) {
  const fullName = composeFullName(employee);
  const position = employee.position_title || "Албан тушаал тодорхойгүй";
  const status = employee.employment_status || "Статус тодорхойгүй";
  const phone = formatContact(employee.phone_number);
  const email = formatContact(employee.email);
  const initials = buildInitials(employee);
  const avatarColors = selectAvatarColors(employee);
  const hasPhoto = Boolean(employee.photo_url);
  const photoUrl = hasPhoto ? resolveFileUrl(employee.photo_url) : "";
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);
  const hasCv = Boolean(employee.cv_url);
  const startDateLabel = (() => {
    if (!employee.start_date) {
      return "Огноо байхгүй";
    }
    const parsed = new Date(employee.start_date);
    if (Number.isNaN(parsed.getTime())) {
      return "Огноо байхгүй";
    }
    return parsed.toLocaleDateString("mn-MN");
  })();

  const handleView = () => {
    onView?.(employee);
  };

  const handleCardKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleView();
    }
  };

  useEffect(() => {
    setPhotoLoadFailed(false);
  }, [photoUrl]);

  return (
    <article
      className={`group relative flex flex-col gap-4 overflow-hidden rounded-3xl border p-6 text-slate-700 shadow-[0_24px_60px_rgba(15,23,42,0.08)] transition hover:-translate-y-1.5 focus-visible:outline-none focus-visible:ring-2 ${
        isDark
          ? "border-slate-800 bg-slate-900/80 text-slate-100 hover:border-slate-600 hover:shadow-[0_32px_90px_rgba(15,23,42,0.45)] focus-visible:ring-slate-700"
          : "border-slate-200/80 bg-white/90 hover:border-sky-200 hover:shadow-[0_32px_90px_rgba(12,74,110,0.22)] focus-visible:ring-sky-200"
      }`}
      onClick={handleView}
      onKeyDown={handleCardKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${fullName} дэлгэрэнгүй`}
    >
      <span
        className={`absolute inset-x-0 top-0 h-1.5 transition-transform group-hover:scale-x-105 ${
          isDark ? "bg-slate-600" : "bg-[#191e21]"
        }`}
        aria-hidden="true"
      ></span>
      <div className="flex items-start gap-4">
        {hasPhoto && !photoLoadFailed ? (
          <img
            src={photoUrl}
            alt={`${fullName} зураг`}
            loading="lazy"
            className={`h-16 w-16 shrink-0 rounded-2xl object-cover shadow-[0_12px_30px_rgba(15,23,42,0.18)] ring-4 ${
              isDark ? "ring-slate-800" : "ring-white"
            }`}
            onError={() => setPhotoLoadFailed(true)}
          />
        ) : (
          <span
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold uppercase shadow-[0_12px_30px_rgba(15,23,42,0.18)] ring-4 ${
              isDark ? "ring-slate-800" : "ring-white"
            }`}
            style={{ backgroundColor: avatarColors.bg, color: avatarColors.fg }}
          >
            {initials}
          </span>
        )}
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={`text-lg font-semibold ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {fullName}
            </p>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                isDark
                  ? "bg-slate-800 text-slate-100"
                  : "bg-sky-50 text-sky-700"
              }`}
            >
              {status}
            </span>
            {hasCv ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                  isDark
                    ? "bg-emerald-900/30 text-emerald-200"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path
                    d="M6 10l2.5 2.5L14 7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M4 4h12v12H4z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                CV файл
              </span>
            ) : null}
          </div>
          <p
            className={`text-sm font-medium ${
              isDark ? "text-slate-300" : "text-slate-600"
            }`}
          >
            {position}
          </p>
          <div
            className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${
              isDark ? "text-slate-500" : "text-slate-400"
            }`}
          >
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] ${
                isDark
                  ? "bg-slate-800 text-slate-200"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <path
                  d="M10 3.5V10l3 2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="10" cy="10" r="7" />
              </svg>
              {startDateLabel}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit?.(employee);
            }}
            className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 ${
              isDark
                ? "border-slate-700 text-slate-200 hover:border-slate-500 hover:text-white focus:ring-slate-700"
                : "border-slate-200 text-slate-700 hover:border-sky-300 hover:text-sky-700 focus:ring-sky-100"
            }`}
            title="Мэдээлэл засах"
          >
            Засах
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete?.(employee);
            }}
            className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed ${
              isDark
                ? "border-red-900 text-red-300 hover:border-red-700 hover:text-red-200 focus:ring-red-900 disabled:border-slate-800 disabled:text-slate-600"
                : "border-red-200 text-red-600 hover:border-red-300 hover:text-red-700 focus:ring-red-100 disabled:border-slate-200 disabled:text-slate-400"
            }`}
            title="Ажилтныг устгах"
            disabled={isDeleting}
          >
            {isDeleting ? "Устгаж..." : "Устгах"}
          </button>
        </div>
      </div>
      <div
        className={`grid gap-3 rounded-2xl border p-4 text-sm ${
          isDark
            ? "border-slate-800 bg-slate-900/60 text-slate-200"
            : "border-slate-100 bg-slate-50/70 text-slate-600"
        }`}
      >
        <div
          className={`flex items-center justify-between text-xs font-semibold uppercase tracking-wide ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                d="M4 4h12v12H4z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M4 8h12M8 4v12" strokeLinecap="round" />
            </svg>
            Холбогдох
          </span>
          {hasCv ? (
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                isDark
                  ? "bg-emerald-900/30 text-emerald-200"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              CV хавсаргасан
            </span>
          ) : (
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                isDark
                  ? "bg-slate-800 text-slate-300"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              CV байхгүй
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-2 font-medium ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <rect x="3.5" y="5" width="13" height="10" rx="1.5" />
              <path
                d="M4.5 6l5.5 4 5.5-4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Имэйл
          </span>
          <span
            className={`truncate font-semibold ${
              isDark ? "text-slate-100" : "text-slate-900"
            }`}
            title={email}
          >
            {email}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-2 font-medium ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                d="M6.5 3.5h2l1.2 3-1.7 1.2a8.5 8.5 0 003.8 3.8l1.2-1.7 3 1.2v2a1.5 1.5 0 01-1.5 1.5C9.2 14.5 5.5 10.8 5.5 6a1.5 1.5 0 011-1.5z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Утас
          </span>
          <span
            className={`font-semibold ${
              isDark ? "text-slate-100" : "text-slate-900"
            }`}
          >
            {phone}
          </span>
        </div>
      </div>
    </article>
  );
}

function EmployeeFormModal({
  open,
  values = FORM_INITIAL_STATE,
  errors = {},
  onClose,
  onSubmit,
  onChange,
  isSubmitting,
  isEdit,
  statusOptions,
  departmentOptions,
  submitError,
  isDark = false,
}) {
  // Guard against undefined props to keep the form stable.
  const safeValues = values || FORM_INITIAL_STATE;
  const safeErrors = errors || {};

  const hasExistingPhoto = Boolean(safeValues.photoUrl);
  const selectedPhotoLabel = safeValues.photoFile
    ? safeValues.photoFile.name
    : hasExistingPhoto
    ? "Одоогийн зураг"
    : "Зураг сонгогдоогүй";
  const existingPhotoUrl = resolveFileUrl(safeValues.photoUrl);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");

  useEffect(() => {
    if (!safeValues.photoFile) {
      setPhotoPreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(safeValues.photoFile);
    setPhotoPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [safeValues.photoFile]);

  if (!open) {
    return null;
  }

  const hasExistingCv = Boolean(safeValues.cvUrl);
  const selectedCvLabel = safeValues.cvFile
    ? safeValues.cvFile.name
    : hasExistingCv
    ? "Одоогийн CV"
    : "CV сонгогдоогүй";
  const isBusy = Boolean(isSubmitting);

  const displayPhotoUrl = photoPreviewUrl || existingPhotoUrl;

  const handleClearSelectedPhoto = () => {
    onChange("photoFile", null);
  };

  const handleClearCv = () => {
    onChange("cvFile", null);
    onChange("cvUrl", "");
  };

  const handleFieldChange = (field) => (event) => {
    if (field === "cvFile") {
      const file = event.target.files?.[0] ?? null;
      if (!file) {
        return;
      }
      onChange("cvUrl", "");
      onChange(field, file);
      return;
    }
    if (field === "photoFile") {
      const file = event.target.files?.[0] ?? null;
      if (!file) {
        return;
      }
      onChange(field, file);
      return;
    }
    onChange(field, event.target.value);
  };

  const renderError = (field) =>
    safeErrors[field] ? (
      <p className="text-xs text-red-600">{safeErrors[field]}</p>
    ) : null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center px-4 py-10 ${
        isDark ? "bg-slate-950/70" : "bg-slate-900/40"
      }`}
    >
      <div
        className={`w-full max-w-3xl rounded-[30px] p-6 shadow-2xl transition-colors ${
          isDark
            ? "border border-slate-800 bg-slate-900 text-slate-100 shadow-slate-900/50"
            : "bg-white text-slate-800"
        }`}
      >
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2
              className={`text-xl font-semibold ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {isEdit ? "Ажилтны мэдээлэл засах" : "Шинэ ажилтан нэмэх"}
            </h2>
            <p
              className={`text-sm ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              {isEdit
                ? "Ажилтны мэдээллийг шинэчлэн хадгална."
                : "Шинэ ажилтны үндсэн мэдээллийг оруулна уу."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border text-slate-500 transition focus:outline-none focus:ring-2 ${
              isDark
                ? "border-slate-700 hover:border-slate-500 hover:text-white focus:ring-slate-700"
                : "border-slate-200 hover:border-slate-300 hover:text-slate-700 focus:ring-slate-200"
            }`}
            aria-label="Цонх хаах"
          >
            ×
          </button>
        </header>

        {submitError ? (
          <div
            className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
              isDark
                ? "border-red-900/60 bg-red-950/40 text-red-200"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {submitError}
          </div>
        ) : null}

        <form onSubmit={onSubmit}>
          <fieldset className="space-y-5" disabled={isBusy}>
            <div className="grid gap-4 md:grid-cols-2">
              <label
                className={`flex flex-col gap-2 text-sm font-medium ${
                  isDark ? "text-slate-200" : "text-slate-600"
                }`}
              >
                <span>Ажилтны код *</span>
                <input
                  type="text"
                  value={safeValues.employeeCode}
                  onChange={handleFieldChange("employeeCode")}
                  className={`h-11 rounded-2xl border px-4 text-sm font-normal shadow-sm transition focus:outline-none focus:ring-2 ${
                    isDark
                      ? "border-slate-700 bg-slate-900 text-slate-100 focus:border-slate-500 focus:ring-slate-700"
                      : "border-slate-300 text-slate-700 focus:border-sky-400 focus:ring-sky-100"
                  }`}
                  required
                />
                {renderError("employeeCode")}
              </label>
              <label
                className={`flex flex-col gap-2 text-sm font-medium ${
                  isDark ? "text-slate-200" : "text-slate-600"
                }`}
              >
                <span>Имэйл *</span>
                <input
                  type="email"
                  value={safeValues.email}
                  onChange={handleFieldChange("email")}
                  className={`h-11 rounded-2xl border px-4 text-sm font-normal shadow-sm transition focus:outline-none focus:ring-2 ${
                    isDark
                      ? "border-slate-700 bg-slate-900 text-slate-100 focus:border-slate-500 focus:ring-slate-700"
                      : "border-slate-300 text-slate-700 focus:border-sky-400 focus:ring-sky-100"
                  }`}
                  required
                />
                {renderError("email")}
              </label>
              <label
                className={`flex flex-col gap-2 text-sm font-medium ${
                  isDark ? "text-slate-200" : "text-slate-600"
                }`}
              >
                <span>Овог *</span>
                <input
                  type="text"
                  value={safeValues.lastName}
                  onChange={handleFieldChange("lastName")}
                  className={`h-11 rounded-2xl border px-4 text-sm font-normal shadow-sm transition focus:outline-none focus:ring-2 ${
                    isDark
                      ? "border-slate-700 bg-slate-900 text-slate-100 focus:border-slate-500 focus:ring-slate-700"
                      : "border-slate-300 text-slate-700 focus:border-sky-400 focus:ring-sky-100"
                  }`}
                  required
                />
                {renderError("lastName")}
              </label>
              <label
                className={`flex flex-col gap-2 text-sm font-medium ${
                  isDark ? "text-slate-200" : "text-slate-600"
                }`}
              >
                <span>Нэр *</span>
                <input
                  type="text"
                  value={safeValues.firstName}
                  onChange={handleFieldChange("firstName")}
                  className={`h-11 rounded-2xl border px-4 text-sm font-normal shadow-sm transition focus:outline-none focus:ring-2 ${
                    isDark
                      ? "border-slate-700 bg-slate-900 text-slate-100 focus:border-slate-500 focus:ring-slate-700"
                      : "border-slate-300 text-slate-700 focus:border-sky-400 focus:ring-sky-100"
                  }`}
                  required
                />
                {renderError("firstName")}
              </label>
              <label
                className={`flex flex-col gap-2 text-sm font-medium ${
                  isDark ? "text-slate-200" : "text-slate-600"
                }`}
              >
                <span>Албан тушаал *</span>
                <input
                  list="employee-position-options"
                  value={safeValues.positionTitle}
                  onChange={handleFieldChange("positionTitle")}
                  className={`h-11 rounded-2xl border px-4 text-sm font-normal shadow-sm transition focus:outline-none focus:ring-2 ${
                    isDark
                      ? "border-slate-700 bg-slate-900 text-slate-100 focus:border-slate-500 focus:ring-slate-700"
                      : "border-slate-300 text-slate-700 focus:border-sky-400 focus:ring-sky-100"
                  }`}
                  required
                />
                <datalist id="employee-position-options">
                  {departmentOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
                {renderError("positionTitle")}
              </label>
              <label
                className={`flex flex-col gap-2 text-sm font-medium ${
                  isDark ? "text-slate-200" : "text-slate-600"
                }`}
              >
                <span>Ажил эрхлэлт *</span>
                <input
                  list="employee-status-options"
                  value={safeValues.employmentStatus}
                  onChange={handleFieldChange("employmentStatus")}
                  className={`h-11 rounded-2xl border px-4 text-sm font-normal shadow-sm transition focus:outline-none focus:ring-2 ${
                    isDark
                      ? "border-slate-700 bg-slate-900 text-slate-100 focus:border-slate-500 focus:ring-slate-700"
                      : "border-slate-300 text-slate-700 focus:border-sky-400 focus:ring-sky-100"
                  }`}
                  required
                />
                <datalist id="employee-status-options">
                  {statusOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
                {renderError("employmentStatus")}
              </label>
              <label
                className={`flex flex-col gap-2 text-sm font-medium ${
                  isDark ? "text-slate-200" : "text-slate-600"
                }`}
              >
                <span>Утас</span>
                <input
                  type="tel"
                  value={safeValues.phoneNumber}
                  onChange={handleFieldChange("phoneNumber")}
                  className={`h-11 rounded-2xl border px-4 text-sm font-normal shadow-sm transition focus:outline-none focus:ring-2 ${
                    isDark
                      ? "border-slate-700 bg-slate-900 text-slate-100 focus:border-slate-500 focus:ring-slate-700"
                      : "border-slate-300 text-slate-700 focus:border-sky-400 focus:ring-sky-100"
                  }`}
                />
                {renderError("phoneNumber")}
              </label>
              <label
                className={`flex flex-col gap-2 text-sm font-medium ${
                  isDark ? "text-slate-200" : "text-slate-600"
                }`}
              >
                <span>Нас</span>
                <input
                  type="number"
                  min="0"
                  value={safeValues.age}
                  onChange={handleFieldChange("age")}
                  className={`h-11 rounded-2xl border px-4 text-sm font-normal shadow-sm transition focus:outline-none focus:ring-2 ${
                    isDark
                      ? "border-slate-700 bg-slate-900 text-slate-100 focus:border-slate-500 focus:ring-slate-700"
                      : "border-slate-300 text-slate-700 focus:border-sky-400 focus:ring-sky-100"
                  }`}
                />
                {renderError("age")}
              </label>
              <label
                className={`flex flex-col gap-2 text-sm font-medium ${
                  isDark ? "text-slate-200" : "text-slate-600"
                }`}
              >
                <span>Хүйс</span>
                <select
                  value={safeValues.gender}
                  onChange={handleFieldChange("gender")}
                  className={`h-11 rounded-2xl border px-4 text-sm font-normal shadow-sm transition focus:outline-none focus:ring-2 ${
                    isDark
                      ? "border-slate-700 bg-slate-900 text-slate-100 focus:border-slate-500 focus:ring-slate-700"
                      : "border-slate-300 text-slate-700 focus:border-sky-400 focus:ring-sky-100"
                  }`}
                >
                  <option value="">Сонгох</option>
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {renderError("gender")}
              </label>
              <label
                className={`flex flex-col gap-2 text-sm font-medium ${
                  isDark ? "text-slate-200" : "text-slate-600"
                }`}
              >
                <span>Ажилд орсон он сар</span>
                <input
                  type="date"
                  value={safeValues.startDate}
                  onChange={handleFieldChange("startDate")}
                  className={`h-11 rounded-2xl border px-4 text-sm font-normal shadow-sm transition focus:outline-none focus:ring-2 ${
                    isDark
                      ? "border-slate-700 bg-slate-900 text-slate-100 focus:border-slate-500 focus:ring-slate-700"
                      : "border-slate-300 text-slate-700 focus:border-sky-400 focus:ring-sky-100"
                  }`}
                />
                {renderError("startDate")}
              </label>

              <label
                className={`flex flex-col gap-2 text-sm font-medium ${
                  isDark ? "text-slate-200" : "text-slate-600"
                }`}
              >
                <span>Профайл зураг</span>
                <div
                  className={`flex flex-col gap-3 rounded-2xl border p-4 shadow-sm ${
                    isDark
                      ? "border-slate-700 bg-slate-900"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <label
                      className={`relative inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold shadow-sm transition focus-within:ring-2 ${
                        isDark
                          ? "border-slate-600 bg-slate-800 text-slate-100 hover:border-slate-400 focus-within:ring-slate-700"
                          : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 focus-within:ring-sky-100"
                      }`}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFieldChange("photoFile")}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        aria-label="Профайл зураг сонгох"
                      />
                      Зураг сонгох
                    </label>

                    {safeValues.photoFile ? (
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold shadow-sm ${
                          isDark
                            ? "border border-slate-700 bg-slate-800 text-slate-100"
                            : "bg-white text-slate-700"
                        }`}
                      >
                        <span
                          className="truncate max-w-40"
                          title={selectedPhotoLabel}
                        >
                          {selectedPhotoLabel}
                        </span>
                        <button
                          type="button"
                          onClick={handleClearSelectedPhoto}
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold transition ${
                            isDark
                              ? "bg-slate-700 text-slate-100 hover:bg-slate-600"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          Болих
                        </button>
                      </span>
                    ) : hasExistingPhoto ? (
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold shadow-sm ${
                          isDark
                            ? "border border-slate-700 bg-slate-800 text-slate-100"
                            : "bg-white text-slate-700"
                        }`}
                      >
                        {selectedPhotoLabel}
                      </span>
                    ) : (
                      <span
                        className={`text-xs font-medium ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Зураг сонгоогүй байна
                      </span>
                    )}
                  </div>

                  <div
                    className={`flex flex-wrap items-center gap-3 text-[12px] ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold shadow-sm ${
                        isDark
                          ? "border border-slate-700 bg-slate-800 text-slate-200"
                          : "bg-white text-slate-600"
                      }`}
                    >
                      Зураг, 5MB хүртэл
                    </span>
                    {isEdit && existingPhotoUrl ? (
                      <a
                        href={existingPhotoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`text-xs font-semibold underline ${
                          isDark ? "text-sky-300" : "text-sky-700"
                        }`}
                      >
                        Одоогийн зургийг нээх
                      </a>
                    ) : null}
                  </div>

                  {displayPhotoUrl ? (
                    <img
                      src={displayPhotoUrl}
                      alt="Профайл зураг"
                      className={`h-32 w-32 rounded-2xl border object-cover ${
                        isDark ? "border-slate-700" : "border-slate-200"
                      }`}
                    />
                  ) : null}
                </div>
              </label>

              <label
                className={`flex flex-col gap-2 text-sm font-medium ${
                  isDark ? "text-slate-200" : "text-slate-600"
                }`}
              >
                <span>CV (PDF)</span>
                <div
                  className={`flex flex-col gap-3 rounded-2xl border p-4 shadow-sm ${
                    isDark
                      ? "border-slate-700 bg-slate-900"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <label
                      className={`relative inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold shadow-sm transition focus-within:ring-2 ${
                        isDark
                          ? "border-slate-600 bg-slate-800 text-slate-100 hover:border-slate-400 focus-within:ring-slate-700"
                          : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 focus-within:ring-sky-100"
                      }`}
                    >
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleFieldChange("cvFile")}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        aria-label="CV файл сонгох"
                      />
                      Файл сонгох
                    </label>

                    {safeValues.cvFile || hasExistingCv ? (
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold shadow-sm ${
                          isDark
                            ? "border border-slate-700 bg-slate-800 text-slate-100"
                            : "bg-white text-slate-700"
                        }`}
                      >
                        <span
                          className="truncate max-w-40"
                          title={selectedCvLabel}
                        >
                          {selectedCvLabel}
                        </span>
                        <button
                          type="button"
                          onClick={handleClearCv}
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold transition ${
                            isDark
                              ? "bg-slate-700 text-slate-100 hover:bg-slate-600"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          Устгах
                        </button>
                      </span>
                    ) : (
                      <span
                        className={`text-xs font-medium ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        CV сонгоогүй байна
                      </span>
                    )}
                  </div>

                  <div
                    className={`flex flex-wrap items-center gap-3 text-[12px] ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold shadow-sm ${
                        isDark
                          ? "border border-slate-700 bg-slate-800 text-slate-200"
                          : "bg-white text-slate-600"
                      }`}
                    >
                      PDF, 10MB хүртэл
                    </span>
                    {isEdit && resolveFileUrl(safeValues.cvUrl) ? (
                      <a
                        href={resolveFileUrl(safeValues.cvUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className={`text-xs font-semibold underline ${
                          isDark ? "text-sky-300" : "text-sky-700"
                        }`}
                      >
                        Одоогийн CV нээх
                      </a>
                    ) : null}
                  </div>

                  {renderError("cvUrl")}
                </div>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className={`inline-flex h-11 items-center justify-center rounded-full border px-5 text-sm font-semibold transition focus:outline-none focus:ring-2 ${
                  isDark
                    ? "border-slate-700 text-slate-200 hover:border-slate-500 hover:text-white focus:ring-slate-700"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800 focus:ring-slate-200"
                }`}
              >
                Цуцлах
              </button>
              <button
                type="submit"
                className={`inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-semibold shadow-lg transition hover:-translate-y-px focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-70 ${
                  isDark
                    ? "bg-slate-200 text-slate-900 shadow-slate-900/40 focus:ring-slate-700 hover:shadow-slate-800/60"
                    : "bg-[#191e21] text-white shadow-sky-900/25 focus:ring-sky-200"
                }`}
              >
                {isSubmitting
                  ? "Хадгалж байна..."
                  : isEdit
                  ? "Мэдээлэл шинэчлэх"
                  : "Хадгалах"}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}

function Employees() {
  const [employees, setEmployees] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortField, setSortField] = useState("last_name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [refreshToken, setRefreshToken] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formValues, setFormValues] = useState(FORM_INITIAL_STATE);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === "undefined") {
      return false;
    }
    return document.body.classList.contains("theme-dark");
  });

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }
    const body = document.body;
    const syncTheme = () => setIsDark(body.classList.contains("theme-dark"));
    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(body, { attributes: true, attributeFilter: ["class"] });

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMedia = () => syncTheme();
    media.addEventListener("change", handleMedia);

    const handleStorage = (event) => {
      if (event.key === "theme") {
        syncTheme();
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
    const handle = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 500);

    return () => clearTimeout(handle);
  }, [debouncedSearch, searchTerm]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchEmployees = async () => {
      setLoading(true);
      try {
        const baseParams = {
          pageSize: API_PAGE_SIZE,
          sort: sortField,
          order: sortDirection,
        };

        if (selectedStatus) {
          baseParams.status = selectedStatus;
        }

        if (selectedDepartment) {
          baseParams.position = selectedDepartment;
        }

        if (debouncedSearch) {
          baseParams.search = debouncedSearch;
        }

        const response = await apiClient.get("/employees", {
          params: baseParams,
          signal: controller.signal,
        });

        console.log("Fetched employees:", response?.data);
        if (!isMounted) {
          return;
        }

        const rawEmployees =
          response?.data?.employees ??
          response?.data?.data ??
          response?.data ??
          [];
        const accumulated = Array.isArray(rawEmployees) ? rawEmployees : [];
        setEmployees(accumulated);

        setStatusOptions((prev) => {
          const set = new Set(prev);
          accumulated.forEach((item) => {
            if (item.employment_status) {
              set.add(item.employment_status);
            }
          });
          return sortLabels(set);
        });

        setDepartmentOptions((prev) => {
          const set = new Set(prev);
          accumulated.forEach((item) => {
            if (item.position_title) {
              set.add(item.position_title);
            }
          });
          return sortLabels(set);
        });
      } catch (err) {
        if (!isMounted || err.code === "ERR_CANCELED") {
          return;
        }
        const message =
          err.response?.data?.message ??
          "Ажилчдын мэдээлэл татах явцад алдаа гарлаа.";
        setError(message);
        setEmployees([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchEmployees();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [
    selectedStatus,
    selectedDepartment,
    sortField,
    sortDirection,
    refreshToken,
    debouncedSearch,
  ]);

  const hasActiveFilters = useMemo(
    () => Boolean(debouncedSearch || selectedStatus || selectedDepartment),
    [debouncedSearch, selectedStatus, selectedDepartment]
  );

  const filteredEmployees = useMemo(() => {
    if (!debouncedSearch) {
      return employees;
    }
    const normalizedQuery = debouncedSearch.toLowerCase();
    return employees.filter((employee) =>
      toSearchString(employee).includes(normalizedQuery)
    );
  }, [employees, debouncedSearch]);

  const departmentSelectOptions = useMemo(
    () => departmentOptions.map((option) => ({ value: option, label: option })),
    [departmentOptions]
  );

  const statusSelectOptions = useMemo(
    () => statusOptions.map((option) => ({ value: option, label: option })),
    [statusOptions]
  );

  const totalEmployees = employees.length;
  const cvAttachedCount = useMemo(
    () => employees.filter((employee) => Boolean(employee.cv_url)).length,
    [employees]
  );
  const roleCount = departmentOptions.length;
  const statusCount = statusOptions.length;

  const totalFiltered = filteredEmployees.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedEmployees = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * pageSize;
    return filteredEmployees.slice(startIndex, startIndex + pageSize);
  }, [filteredEmployees, currentPage, pageSize, totalPages]);

  const pageStart =
    totalFiltered === 0
      ? 0
      : (Math.min(currentPage, totalPages) - 1) * pageSize + 1;
  const pageEnd =
    totalFiltered === 0
      ? 0
      : Math.min(totalFiltered, pageStart + paginatedEmployees.length - 1);

  const handleResetFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setSelectedStatus("");
    setSelectedDepartment("");
    setSortField("last_name");
    setSortDirection("asc");
    setPageSize(DEFAULT_PAGE_SIZE);
    setCurrentPage(1);
    setRefreshToken((prev) => prev + 1);
  };

  const triggerRefresh = useCallback(() => {
    setRefreshToken((prev) => prev + 1);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    debouncedSearch,
    selectedStatus,
    selectedDepartment,
    sortField,
    sortDirection,
  ]);

  const openCreateForm = () => {
    setFormValues(FORM_INITIAL_STATE);
    setEditingEmployee(null);
    setFormErrors({});
    setSubmitError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (employee) => {
    if (!employee) {
      return;
    }
    setIsProfileOpen(false);
    setSelectedEmployeeId(null);
    setFormValues(normalizeEmployeeForForm(employee));
    setEditingEmployee(employee);
    setFormErrors({});
    setSubmitError(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingEmployee(null);
    setFormValues(FORM_INITIAL_STATE);
    setFormErrors({});
    setSubmitError(null);
  };

  const openProfileModal = (employee) => {
    if (!employee?.id) {
      return;
    }
    setSelectedEmployeeId(employee.id);
    setIsProfileOpen(true);
  };

  const closeProfileModal = () => {
    setIsProfileOpen(false);
    setSelectedEmployeeId(null);
  };

  const handleFormChange = (field, value) => {
    setFormValues((previous) => ({
      ...previous,
      [field]: value,
    }));
    setFormErrors((previous) => {
      if (!previous[field]) {
        return previous;
      }
      const { [field]: _removed, ...rest } = previous;
      return rest;
    });
  };

  const validateForm = (valuesToValidate = FORM_INITIAL_STATE) => {
    const nextErrors = {};
    Object.entries(REQUIRED_FIELDS).forEach(([field, label]) => {
      if (!valuesToValidate?.[field]?.trim?.()) {
        nextErrors[field] = `${label} талбарыг оруулна уу.`;
      }
    });

    const emailValue = valuesToValidate?.email?.trim?.();
    if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      nextErrors.email = "Зөв имэйл хаяг оруулна уу.";
    }

    const ageValue = valuesToValidate?.age;
    if (ageValue !== undefined && ageValue !== null && ageValue !== "") {
      const parsedAge = Number(ageValue);
      if (!Number.isFinite(parsedAge) || parsedAge < 0) {
        nextErrors.age = "Насны утга буруу байна.";
      }
    }

    return nextErrors;
  };

  const handleSubmitForm = async (event) => {
    event.preventDefault();
    const currentValues = formValues || FORM_INITIAL_STATE;
    const validationErrors = validateForm(currentValues);
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    if (currentValues.cvFile) {
      if (currentValues.cvFile.type !== "application/pdf") {
        setSubmitError("CV файл PDF өргөтгөлтэй байх шаардлагатай.");
        return;
      }
      if (currentValues.cvFile.size > MAX_CV_SIZE_BYTES) {
        setSubmitError("CV файл 10MB-аас бага байх ёстой.");
        return;
      }
    }

    if (currentValues.photoFile) {
      if (!currentValues.photoFile.type?.startsWith?.("image/")) {
        setSubmitError("Профайл зураг нь зураг (image/*) файл байх ёстой.");
        return;
      }
      if (currentValues.photoFile.size > MAX_PHOTO_SIZE_BYTES) {
        setSubmitError("Профайл зураг 5MB-аас бага байх ёстой.");
        return;
      }
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = buildEmployeePayload(currentValues);
      const formData = new FormData();
      formData.append("employeeCode", payload.employeeCode);
      formData.append("firstName", payload.firstName);
      formData.append("lastName", payload.lastName);
      formData.append("email", payload.email);
      formData.append("phoneNumber", payload.phoneNumber);
      formData.append("positionTitle", payload.positionTitle);
      formData.append("employmentStatus", payload.employmentStatus);
      formData.append("gender", payload.gender);
      if (payload.age !== null) {
        formData.append("age", payload.age);
      }
      if (payload.startDate) {
        formData.append("startDate", payload.startDate);
      }
      if (currentValues.cvFile) {
        formData.append("cv", currentValues.cvFile);
      } else if (payload.cvUrl) {
        formData.append("cvUrl", payload.cvUrl);
      }

      let response;
      if (editingEmployee) {
        response = await apiClient.patch(
          `/employees/${editingEmployee.id}`,
          formData
        );
      } else {
        response = await apiClient.post("/employees", formData);
      }

      const savedEmployeeId =
        response?.data?.employee?.id ?? editingEmployee?.id;

      if (currentValues.photoFile) {
        if (!savedEmployeeId) {
          throw new Error("Employee ID missing for photo upload");
        }
        const photoFormData = new FormData();
        photoFormData.append("photo", currentValues.photoFile);
        await apiClient.patch(
          `/employees/${savedEmployeeId}/photo`,
          photoFormData
        );
      }

      closeForm();
      triggerRefresh();
    } catch (err) {
      const message =
        err.response?.data?.message ??
        "Ажилтны мэдээлэл хадгалах явцад алдаа гарлаа.";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (employee) => {
    if (!employee?.id) {
      return;
    }
    const confirmed = window.confirm(
      `${composeFullName(employee)} ажилтны мэдээллийг устгах уу?`
    );
    if (!confirmed) {
      return;
    }
    setDeletingId(employee.id);
    try {
      await apiClient.delete(`/employees/${employee.id}`);
      triggerRefresh();
      if (employee.id === selectedEmployeeId) {
        closeProfileModal();
      }
    } catch (err) {
      const message =
        err.response?.data?.message ??
        "Ажилтны мэдээлэл устгах явцад алдаа гарлаа.";
      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section
      className={`mx-6 px-6 pb-12 rounded-[30px] shadow-lg transition-colors ${
        isDark
          ? "border border-slate-800 bg-slate-900/80 text-slate-100 shadow-slate-900/40"
          : "bg-white text-slate-700"
      }`}
    >
      {error && (
        <div
          className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
            isDark
              ? "border-red-900/60 bg-red-950/40 text-red-200"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {error}
        </div>
      )}

      <div
        className={`mb-6 space-y-5 rounded-[30px] p-5 transition-colors ${
          isDark ? "border border-slate-800 bg-slate-900/70" : "bg-white"
        }`}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FilterSelect
            label="Албан тушаал"
            placeholder="Бүгд"
            value={selectedDepartment}
            onChange={(event) => {
              setSelectedDepartment(event.target.value);
              setCurrentPage(1);
            }}
            options={departmentSelectOptions}
            isDark={isDark}
          />
          <FilterSelect
            label="Ажил эрхлэлт"
            placeholder="Бүгд"
            value={selectedStatus}
            onChange={(event) => {
              setSelectedStatus(event.target.value);
              setCurrentPage(1);
            }}
            options={statusSelectOptions}
            isDark={isDark}
          />
          <FilterSelect
            label="Эрэмбэлэх талбар"
            placeholder=""
            value={sortField}
            onChange={(event) => {
              setSortField(event.target.value);
              setCurrentPage(1);
            }}
            options={SORT_FIELDS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            allowEmpty={false}
            isDark={isDark}
          />
          <SortDirectionToggle
            value={sortDirection}
            onChange={(direction) => {
              setSortDirection(direction);
              setCurrentPage(1);
            }}
            isDark={isDark}
          />
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-4 w-100">
            <Searchbar
              placeholder="Ажилтан"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full min-w-60 max-w-90"
              isDark={isDark}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleResetFilters}
              className={`inline-flex h-11 items-center gap-2 rounded-2xl px-5 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 ${
                isDark
                  ? "border border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500 hover:text-white focus:border-slate-500 focus:ring-slate-700"
                  : "border border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:text-sky-600 focus:border-sky-400 focus:ring-sky-100"
              }`}
              title="Шүүлтүүрийг дахин тохируулах"
              aria-pressed={hasActiveFilters}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 5h18M6 12h12M10 19h4"
                />
              </svg>
              Цэвэрлэх
              {hasActiveFilters && (
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500 px-1 text-xs font-bold text-white">
                  •
                </span>
              )}
            </button>

            <WhiteButton
              label="Ажилтан нэмэх"
              onClick={openCreateForm}
              ariaLabel="Ажилтан нэмэх"
              className={`h-11 px-5 transition ${
                isDark
                  ? "border border-slate-500 bg-slate-100 text-slate-900 hover:border-slate-300 hover:bg-white"
                  : "border-sky-500 bg-sky-500 text-black hover:border-sky-600 hover:bg-[#191e21]"
              }`}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: pageSize }).map((_, index) => (
            <div
              key={index}
              className={`h-60 animate-pulse rounded-[30px] border shadow-[0_16px_30px_rgba(15,80,110,0.06)] ${
                isDark
                  ? "border-slate-800 bg-slate-900/80"
                  : "border-slate-200/70 bg-white"
              }`}
            />
          ))}
        </div>
      ) : totalFiltered === 0 ? (
        <div
          className={`p-10 text-center ${
            isDark
              ? "rounded-3xl border border-slate-800 bg-slate-900/70 text-slate-300"
              : "rounded-3xl bg-white/70 text-slate-500"
          }`}
        >
          Ажилчдын мэдээлэл олдсонгүй.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {paginatedEmployees.map((employee) => (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              onEdit={openEditForm}
              onDelete={handleDeleteEmployee}
              onView={openProfileModal}
              isDeleting={deletingId === employee.id}
              isDark={isDark}
            />
          ))}
        </div>
      )}

      {!loading && totalFiltered > 0 ? (
        <PaginationControls
          page={currentPage}
          totalPages={totalPages}
          totalItems={totalFiltered}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          isDark={isDark}
        />
      ) : null}

      <EmployeeFormModal
        open={isFormOpen}
        values={formValues}
        errors={formErrors}
        onClose={closeForm}
        onSubmit={handleSubmitForm}
        onChange={handleFormChange}
        isSubmitting={isSubmitting}
        isEdit={Boolean(editingEmployee)}
        statusOptions={statusOptions}
        departmentOptions={departmentOptions}
        submitError={submitError}
        isDark={isDark}
      />
      <ProfileModal
        isOpen={isProfileOpen}
        employeeId={selectedEmployeeId}
        onClose={closeProfileModal}
        onEdit={(employee) => {
          if (!employee) {
            return;
          }
          openEditForm(employee);
        }}
      />
      {totalFiltered > 0 ? (
        <span
          className={`mt-5 inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold ${
            isDark
              ? "border border-slate-700 bg-slate-800 text-slate-200"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {pageStart} - {pageEnd} / {totalFiltered}
        </span>
      ) : null}
    </section>
  );
}

export default Employees;
