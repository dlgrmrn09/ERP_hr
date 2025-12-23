import { useEffect, useMemo, useState } from "react";
import apiClient from "../utils/apiClient";
import Searchbar from "../components/Searchbar.jsx";
import EmployeeIcon from "../assets/icons8-employee.svg";
import WhiteButton from "../components/WhiteButton.jsx";

const PAGE_SIZE = 12;

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

function EmployeeCard({ employee }) {
  const fullName = composeFullName(employee);
  const position = employee.position_title || "Албан тушаал тодорхойгүй";
  const status = employee.employment_status || "Статус тодорхойгүй";
  const phone = formatContact(employee.phone_number);
  const email = formatContact(employee.email);

  return (
    <article className="flex flex-col gap-4 rounded-[30px] border border-slate-300 bg-white p-6 ">
      <div className="flex items-start gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-100">
          <img
            src={EmployeeIcon}
            alt=""
            className="h-10 w-10"
            aria-hidden="true"
          />
        </span>
        <div className="flex flex-col gap-1 text-slate-700">
          <p className="text-lg font-semibold text-slate-900">{fullName}</p>
          <p className="text-sm text-slate-600">{position}</p>
          <p className="text-sm font-medium text-sky-600">{status}</p>
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
          pageSize: PAGE_SIZE,
          sort: "last_name",
          order: "asc",
        };

        if (debouncedSearch) {
          params.search = debouncedSearch;
        }
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
  }, [debouncedSearch, selectedStatus, selectedDepartment]);

  const hasActiveFilters = useMemo(
    () => Boolean(debouncedSearch || selectedStatus || selectedDepartment),
    [debouncedSearch, selectedStatus, selectedDepartment]
  );

  const handleResetFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setSelectedStatus("");
    setSelectedDepartment("");
  };

  return (
    <section className="px-6 pb-12 mx-6 bg-white shadow-lg rounded-[30px]">
      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-4  border-slate-200/70 bg-white p-4 ">
        <select
          value={selectedDepartment}
          onChange={(event) => setSelectedDepartment(event.target.value)}
          className="h-12 min-w-40 rounded-2xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-600 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
        >
          <option value="">Department</option>
          {departmentOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(event) => setSelectedStatus(event.target.value)}
          className="h-12 min-w-40 rounded-2xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-600 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
        >
          <option value="">Select status</option>
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <div className="flex flex-1 justify-end gap-4 sm:justify-between">
          <Searchbar
            placeholder="here"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full max-w-[320px]"
          />
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-sky-400 hover:text-sky-600 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
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
        </div>
      </div>

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="h-60 animate-pulse rounded-[30px] border border-slate-200/70 bg-white shadow-[0_16px_30px_rgba(15,80,110,0.06)]"
            />
          ))}
        </div>
      ) : employees.length === 0 ? (
        <div className="  bg-white/70 p-10 text-center text-slate-500 ">
          Ажилчдын мэдээлэл олдсонгүй.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {employees.map((employee) => (
            <EmployeeCard key={employee.id} employee={employee} />
          ))}
        </div>
      )}
    </section>
  );
}

export default Employees;
