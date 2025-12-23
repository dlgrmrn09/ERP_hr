import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "../utils/apiClient";
import Searchbar from "../components/Searchbar.jsx";
import EmployeeIcon from "../assets/icons8-employee.svg";
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

const normalizeOption = (value) =>
  typeof value === "string" && value.trim() !== "" ? value : null;

const formatContact = (value) =>
  value && value.trim() !== "" ? value : "Мэдээлэл байхгүй";

const sortLabels = (values) =>
  Array.from(values)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "mn-MN", { sensitivity: "base" }));

const SORT_FIELDS = [
  { value: "last_name", label: "Овгоор" },
  { value: "first_name", label: "Нэрээр" },
  { value: "employment_status", label: "Статусаар" },
  { value: "start_date", label: "Эхэлсэн он сараар" },
  { value: "created_at", label: "Нэмсэн огноо" },
];

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
  startDate: "",
  cvUrl: "",
};

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
  cvUrl: employee.cv_url ?? "",
});

const buildEmployeePayload = (values) => ({
  employeeCode: values.employeeCode.trim(),
  firstName: values.firstName.trim(),
  lastName: values.lastName.trim(),
  email: values.email.trim().toLowerCase(),
  phoneNumber: values.phoneNumber.trim(),
  positionTitle: values.positionTitle.trim(),
  employmentStatus: values.employmentStatus.trim(),
  gender: values.gender.trim(),
  age: values.age === "" ? null : values.age.trim(),
  startDate: values.startDate || null,
  cvUrl: values.cvUrl.trim(),
});

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

const createPageList = (current, total, maxVisible = 5) => {
  if (total <= 1) {
    return [1];
  }
  const half = Math.floor(maxVisible / 2);
  let start = Math.max(1, current - half);
  let end = Math.min(total, start + maxVisible - 1);
  start = Math.max(1, end - maxVisible + 1);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
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
}) {
  return (
    <label
      className={`flex flex-col gap-2 text-xs font-semibold ${
        uppercaseLabel ? "uppercase tracking-wide" : ""
      } text-slate-500 ${className}`}
    >
      <span>{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 pr-11 text-sm font-medium text-slate-700 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
        >
          {allowEmpty && placeholder ? (
            <option value="">{placeholder}</option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
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
              d="M6 8l4 4 4-4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </label>
  );
}

function SortDirectionToggle({ value, onChange }) {
  return (
    <fieldset className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
      <legend>Эрэмбийн чиглэл</legend>
      <div className="inline-flex w-full items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
        {["asc", "desc"].map((direction) => {
          const isActive = value === direction;
          return (
            <button
              type="button"
              key={direction}
              onClick={() => onChange(direction)}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 ${
                isActive
                  ? "bg-sky-500 text-white shadow-[0_12px_20px_rgba(14,116,144,0.2)]"
                  : "text-slate-600 hover:bg-white"
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
}) {
  if (totalPages <= 1) {
    return null;
  }

  const pages = createPageList(page, totalPages);

  return (
    <nav
      className="mt-10 flex flex-col gap-4 rounded-[24px] border border-slate-200/70 bg-white/60 px-4 py-3 text-sm text-slate-600 shadow-sm sm:flex-row sm:items-center sm:justify-between"
      aria-label="Хуудаслалт"
    >
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 font-semibold text-slate-600 transition hover:border-sky-400 hover:text-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
          disabled={page === 1}
        >
          Өмнөх
        </button>
        <div className="flex items-center gap-1">
          {pages.map((pageNumber) => {
            const isActive = pageNumber === page;
            return (
              <button
                type="button"
                key={pageNumber}
                onClick={() => onPageChange(pageNumber)}
                className={`h-10 min-w-[40px] rounded-full border px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-100 ${
                  isActive
                    ? "border-sky-500 bg-sky-500 text-white shadow-[0_12px_20px_rgba(14,116,144,0.18)]"
                    : "border-slate-200 bg-white text-slate-600 hover:border-sky-400 hover:text-sky-600"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {pageNumber}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 font-semibold text-slate-600 transition hover:border-sky-400 hover:text-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
          disabled={page === totalPages}
        >
          Дараах
        </button>
      </div>
    </nav>
  );
}

function EmployeeCard({ employee, onEdit, onDelete, isDeleting }) {
  const fullName = composeFullName(employee);
  const position = employee.position_title || "Албан тушаал тодорхойгүй";
  const status = employee.employment_status || "Статус тодорхойгүй";
  const phone = formatContact(employee.phone_number);
  const email = formatContact(employee.email);

  return (
    <article className="flex flex-col gap-4 rounded-[30px] border border-slate-300 bg-white p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-100">
          <img
            src={EmployeeIcon}
            alt=""
            className="h-10 w-10"
            aria-hidden="true"
          />
        </span>
        <div className="flex flex-1 flex-col gap-1 text-slate-700">
          <p className="text-lg font-semibold text-slate-900">{fullName}</p>
          <p className="text-sm text-slate-600">{position}</p>
          <p className="text-sm font-medium text-sky-600">{status}</p>
        </div>
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => onEdit?.(employee)}
            className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-100"
            title="Мэдээлэл засах"
          >
            Засах
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(employee)}
            className="inline-flex items-center rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            title="Ажилтныг устгах"
            disabled={isDeleting}
          >
            {isDeleting ? "Устгаж..." : "Устгах"}
          </button>
        </div>
      </div>
      <div className="grid gap-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-500">Утас</span>
          <span className="font-semibold text-slate-800">{phone}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-500">Имэйл</span>
          <span className="truncate font-semibold text-slate-800" title={email}>
            {email}
          </span>
        </div>
      </div>
    </article>
  );
}

function EmployeeFormModal({
  open,
  values,
  errors,
  onClose,
  onSubmit,
  onChange,
  isSubmitting,
  isEdit,
  statusOptions,
  departmentOptions,
  submitError,
}) {
  if (!open) {
    return null;
  }

  const handleFieldChange = (field) => (event) => {
    onChange(field, event.target.value);
  };

  const renderError = (field) =>
    errors[field] ? (
      <p className="text-xs text-red-600">{errors[field]}</p>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-10">
      <div className="w-full max-w-3xl rounded-[30px] bg-white p-6 shadow-2xl">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {isEdit ? "Ажилтны мэдээлэл засах" : "Шинэ ажилтан нэмэх"}
            </h2>
            <p className="text-sm text-slate-500">
              {isEdit
                ? "Ажилтны мэдээллийг шинэчлэн хадгална."
                : "Шинэ ажилтны үндсэн мэдээллийг оруулна уу."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
            aria-label="Цонх хаах"
          >
            ×
          </button>
        </header>

        {submitError ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-600">
              <span>Ажилтны код *</span>
              <input
                type="text"
                value={values.employeeCode}
                onChange={handleFieldChange("employeeCode")}
                className="h-11 rounded-2xl border border-slate-300 px-4 text-sm font-normal text-slate-700 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                required
              />
              {renderError("employeeCode")}
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-600">
              <span>Имэйл *</span>
              <input
                type="email"
                value={values.email}
                onChange={handleFieldChange("email")}
                className="h-11 rounded-2xl border border-slate-300 px-4 text-sm font-normal text-slate-700 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                required
              />
              {renderError("email")}
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-600">
              <span>Овог *</span>
              <input
                type="text"
                value={values.lastName}
                onChange={handleFieldChange("lastName")}
                className="h-11 rounded-2xl border border-slate-300 px-4 text-sm font-normal text-slate-700 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                required
              />
              {renderError("lastName")}
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-600">
              <span>Нэр *</span>
              <input
                type="text"
                value={values.firstName}
                onChange={handleFieldChange("firstName")}
                className="h-11 rounded-2xl border border-slate-300 px-4 text-sm font-normal text-slate-700 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                required
              />
              {renderError("firstName")}
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-600">
              <span>Албан тушаал *</span>
              <input
                list="employee-position-options"
                value={values.positionTitle}
                onChange={handleFieldChange("positionTitle")}
                className="h-11 rounded-2xl border border-slate-300 px-4 text-sm font-normal text-slate-700 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                required
              />
              <datalist id="employee-position-options">
                {departmentOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              {renderError("positionTitle")}
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-600">
              <span>Ажил эрхлэлт *</span>
              <input
                list="employee-status-options"
                value={values.employmentStatus}
                onChange={handleFieldChange("employmentStatus")}
                className="h-11 rounded-2xl border border-slate-300 px-4 text-sm font-normal text-slate-700 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                required
              />
              <datalist id="employee-status-options">
                {statusOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              {renderError("employmentStatus")}
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-600">
              <span>Утас</span>
              <input
                type="tel"
                value={values.phoneNumber}
                onChange={handleFieldChange("phoneNumber")}
                className="h-11 rounded-2xl border border-slate-300 px-4 text-sm font-normal text-slate-700 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
              {renderError("phoneNumber")}
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-600">
              <span>Нас</span>
              <input
                type="number"
                min="0"
                value={values.age}
                onChange={handleFieldChange("age")}
                className="h-11 rounded-2xl border border-slate-300 px-4 text-sm font-normal text-slate-700 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
              {renderError("age")}
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-600">
              <span>Хүйс</span>
              <input
                type="text"
                value={values.gender}
                onChange={handleFieldChange("gender")}
                className="h-11 rounded-2xl border border-slate-300 px-4 text-sm font-normal text-slate-700 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
              {renderError("gender")}
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-600">
              <span>Ажилд орсон он сар</span>
              <input
                type="date"
                value={values.startDate}
                onChange={handleFieldChange("startDate")}
                className="h-11 rounded-2xl border border-slate-300 px-4 text-sm font-normal text-slate-700 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
              {renderError("startDate")}
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-600">
              <span>CV холбоос</span>
              <input
                type="url"
                value={values.cvUrl}
                onChange={handleFieldChange("cvUrl")}
                className="h-11 rounded-2xl border border-slate-300 px-4 text-sm font-normal text-slate-700 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                placeholder="https://"
              />
              {renderError("cvUrl")}
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              Болих
            </button>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-full border border-sky-500 bg-sky-500 px-6 text-sm font-semibold text-white transition hover:border-sky-600 hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:border-sky-300 disabled:bg-sky-300"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Хадгалж байна..."
                : isEdit
                ? "Шинэчлэх"
                : "Нэмэх"}
            </button>
          </div>
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

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);

    return () => clearTimeout(handle);
  }, [searchTerm]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchEmployees = async () => {
      setLoading(true);
      try {
        const params = {
          page: 1,
          pageSize: API_PAGE_SIZE,
          sort: sortField,
          order: sortDirection,
        };

        if (selectedStatus) {
          params.status = selectedStatus;
        }
        if (selectedDepartment) {
          params.position = selectedDepartment;
        }

        const response = await apiClient.get("/employees", {
          params,
          signal: controller.signal,
        });

        if (!isMounted) {
          return;
        }

        const data = response.data?.data ?? [];
        setEmployees(data);
        setError(null);

        setStatusOptions((prev) => {
          const accumulated = new Set(prev);
          data.forEach((item) => {
            const value = normalizeOption(item.employment_status);
            if (value) {
              accumulated.add(value);
            }
          });
          return sortLabels(accumulated);
        });

        setDepartmentOptions((prev) => {
          const accumulated = new Set(prev);
          data.forEach((item) => {
            const value = normalizeOption(item.position_title);
            if (value) {
              accumulated.add(value);
            }
          });
          return sortLabels(accumulated);
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

  const validateForm = (valuesToValidate) => {
    const nextErrors = {};
    Object.entries(REQUIRED_FIELDS).forEach(([field, label]) => {
      if (!valuesToValidate[field]?.trim()) {
        nextErrors[field] = `${label} талбарыг оруулна уу.`;
      }
    });

    if (
      valuesToValidate.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valuesToValidate.email.trim())
    ) {
      nextErrors.email = "Зөв имэйл хаяг оруулна уу.";
    }

    if (valuesToValidate.age) {
      const parsedAge = Number(valuesToValidate.age);
      if (!Number.isFinite(parsedAge) || parsedAge < 0) {
        nextErrors.age = "Насны утга буруу байна.";
      }
    }

    return nextErrors;
  };

  const handleSubmitForm = async (event) => {
    event.preventDefault();
    const validationErrors = validateForm(formValues);
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = buildEmployeePayload(formValues);
      if (editingEmployee) {
        await apiClient.patch(`/employees/${editingEmployee.id}`, payload);
      } else {
        await apiClient.post("/employees", payload);
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
    <section className="px-6 pb-12 mx-6 bg-white shadow-lg rounded-[30px]">
      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 space-y-5 rounded-[30px] border border-slate-200/70 bg-white p-5">
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
          />
          <SortDirectionToggle
            value={sortDirection}
            onChange={(direction) => {
              setSortDirection(direction);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <Searchbar
              placeholder="Нэр, код, утас, имэйл..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full min-w-[240px] max-w-[360px]"
            />
            {totalFiltered > 0 ? (
              <span className="inline-flex h-10 items-center rounded-full bg-slate-100 px-4 text-sm font-semibold text-slate-600">
                {pageStart} - {pageEnd} / {totalFiltered}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-sky-400 hover:text-sky-600 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
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
              Filter
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
              className="h-11 px-5 border-sky-500 bg-sky-500 text-white transition hover:border-sky-600 hover:bg-sky-600 hover:text-white"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: pageSize }).map((_, index) => (
            <div
              key={index}
              className="h-60 animate-pulse rounded-[30px] border border-slate-200/70 bg-white shadow-[0_16px_30px_rgba(15,80,110,0.06)]"
            />
          ))}
        </div>
      ) : totalFiltered === 0 ? (
        <div className="bg-white/70 p-10 text-center text-slate-500">
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
              isDeleting={deletingId === employee.id}
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
      />
    </section>
  );
}

export default Employees;
