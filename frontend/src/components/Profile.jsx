import { useEffect, useMemo, useState } from "react";
import apiClient from "../utils/apiClient";

const TABS = [
  { id: "basic", label: "Үндсэн" },
  { id: "personal", label: "Хувийн мэдээлэл" },
  { id: "documents", label: "Бичиг баримт" },
];

const resolveStatusAccent = (status) => {
  const normalized = (status || "").toLowerCase();
  if (!normalized) {
    return {
      badge: "bg-slate-100 text-slate-600",
      label: "Статус тодорхойгүй",
    };
  }
  if (
    ["active", "идэвх", "ажиллаж"].some((token) => normalized.includes(token))
  ) {
    return { badge: "bg-emerald-100 text-emerald-700", label: status };
  }
  if (
    ["suspend", "түр", "inactive", "амар"].some((token) =>
      normalized.includes(token)
    )
  ) {
    return { badge: "bg-amber-100 text-amber-700", label: status };
  }
  if (
    ["terminate", "тэтгэвэр", "leav"].some((token) =>
      normalized.includes(token)
    )
  ) {
    return { badge: "bg-rose-100 text-rose-700", label: status };
  }
  return { badge: "bg-slate-100 text-slate-600", label: status };
};

const formatDate = (value) => {
  if (!value) {
    return "Мэдээлэл байхгүй";
  }
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat("mn-MN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch (error) {
    return value;
  }
};

const normalizeText = (value) => {
  if (!value) {
    return "Мэдээлэл байхгүй";
  }
  const trimmed = String(value).trim();
  return trimmed === "" ? "Мэдээлэл байхгүй" : trimmed;
};

const buildInitials = (employee) => {
  if (!employee) {
    return "?";
  }
  const firstName = employee.first_name || employee.firstName || "";
  const lastName = employee.last_name || employee.lastName || "";
  const firstInitial = firstName.trim().charAt(0).toUpperCase();
  const lastInitial = lastName.trim().charAt(0).toUpperCase();
  if (firstInitial && lastInitial) {
    return `${lastInitial}${firstInitial}`;
  }
  if (lastInitial) {
    return lastInitial;
  }
  if (firstInitial) {
    return firstInitial;
  }
  const code = employee.employee_code || employee.employeeCode || "";
  return code.trim().charAt(0).toUpperCase() || "?";
};

function ProfileModal({ isOpen, onClose, employeeId, onEdit }) {
  const [activeTab, setActiveTab] = useState("basic");
  const [employee, setEmployee] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setActiveTab("basic");
      setEmployee(null);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !employeeId) {
      return undefined;
    }

    const controller = new AbortController();
    const fetchEmployee = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await apiClient.get(`/employees/${employeeId}`, {
          signal: controller.signal,
        });
        setEmployee(response.data?.employee || null);
      } catch (apiError) {
        if (controller.signal.aborted) {
          return;
        }
        const message =
          apiError?.response?.data?.message ||
          apiError?.message ||
          "Мэдээлэл татахад алдаа гарлаа";
        setError(message);
        setEmployee(null);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchEmployee();
    return () => {
      controller.abort();
    };
  }, [isOpen, employeeId]);

  const fullName = useMemo(() => {
    if (!employee) {
      return "Ажилтны мэдээлэл";
    }
    const parts = [employee.last_name, employee.first_name]
      .filter(Boolean)
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    if (parts.length > 0) {
      return parts.join(" ");
    }
    return employee.employee_code || "Ажилтны мэдээлэл";
  }, [employee]);

  const employmentStatus = useMemo(
    () => resolveStatusAccent(employee?.employment_status),
    [employee]
  );

  const summaryMetrics = useMemo(
    () => [
      {
        label: "Хоцорсон",
        value: employee?.total_late ?? 0,
        suffix: "удаа",
      },
      {
        label: "Ирц тасалсан",
        value: employee?.total_absent ?? 0,
        suffix: "удаа",
      },
      {
        label: "Илүү цаг",
        value: employee?.total_overtime_minutes ?? 0,
        suffix: "мин",
      },
    ],
    [employee]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-5 py-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex w-full max-w-150 max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-slate-900">{fullName}</h2>
          </div>
          <div className="flex items-center gap-2">
            {typeof onEdit === "function" ? (
              <button
                type="button"
                onClick={() => {
                  if (!employee) {
                    return;
                  }
                  onEdit(employee);
                }}
                disabled={!employee}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
              >
                Засах
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              onClick={onClose}
              aria-label="Хаах"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-6 overflow-y-auto px-6 py-6">
          <section className="flex flex-col items-center gap-3 rounded-2xl bg-[#191e21] px-6 py-7 text-white shadow-lg">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/40 bg-white/10 text-3xl font-semibold">
              {buildInitials(employee)}
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xl font-semibold leading-tight">
                {fullName}
              </span>
              <span className="text-sm text-slate-200">
                {normalizeText(employee?.position_title)}
              </span>
            </div>
            <span
              className={`rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wide ${employmentStatus.badge}`}
            >
              {employmentStatus.label}
            </span>
            <div className="grid w-full grid-cols-3 gap-3">
              {summaryMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-xl bg-white/10 px-3 py-3 text-center shadow-inner"
                >
                  <p className="text-[11px] uppercase tracking-wide text-slate-200">
                    {metric.label}
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {metric.value}
                    <span className="ml-1 text-xs font-medium text-slate-200">
                      {metric.suffix}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </section>

          <nav className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 ${
                    isActive
                      ? "bg-[#191e21] text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <section className="rounded-2xl border border-slate-100 bg-white px-5 py-6 shadow-sm">
            {isLoading ? (
              <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
                <span className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500"></span>
                <p className="text-sm font-medium">Ачаалж байна...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-rose-500">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => {
                    if (!employeeId) {
                      return;
                    }
                    setActiveTab("basic");
                    setIsLoading(true);
                    setError(null);
                    apiClient
                      .get(`/employees/${employeeId}`)
                      .then((response) => {
                        setEmployee(response.data?.employee || null);
                      })
                      .catch((retryError) => {
                        const retryMessage =
                          retryError?.response?.data?.message ||
                          retryError?.message ||
                          "Мэдээлэл татахад алдаа гарлаа";
                        setError(retryMessage);
                      })
                      .finally(() => {
                        setIsLoading(false);
                      });
                  }}
                  className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                >
                  Дахин оролдох
                </button>
              </div>
            ) : !employee ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-slate-400">
                <p>Ажилтныг сонгож, дэлгэрэнгүй мэдээллийг харна уу.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {activeTab === "basic" ? (
                  <div className="grid gap-6">
                    <div>
                      <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                        Холбоо барих
                      </h3>
                      <dl className="mt-4 grid gap-3">
                        <div className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                          <dt className="text-sm font-medium text-slate-500">
                            Утас
                          </dt>
                          <dd className="text-sm font-semibold text-slate-800">
                            {normalizeText(employee.phone_number)}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                          <dt className="text-sm font-medium text-slate-500">
                            Имэйл
                          </dt>
                          <dd className="text-sm font-semibold text-slate-800">
                            {normalizeText(employee.email)}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div>
                      <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                        Ажлын мэдээлэл
                      </h3>
                      <dl className="mt-4 grid gap-3">
                        <div className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                          <dt className="text-sm font-medium text-slate-500">
                            Албан тушаал
                          </dt>
                          <dd className="text-sm font-semibold text-slate-800">
                            {normalizeText(employee.position_title)}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                          <dt className="text-sm font-medium text-slate-500">
                            Ажилд орсон
                          </dt>
                          <dd className="text-sm font-semibold text-slate-800">
                            {formatDate(employee.start_date)}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                          <dt className="text-sm font-medium text-slate-500">
                            Код
                          </dt>
                          <dd className="text-sm font-semibold text-slate-800">
                            {normalizeText(employee.employee_code)}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                          <dt className="text-sm font-medium text-slate-500">
                            Ажил эрхлэлт
                          </dt>
                          <dd className="text-sm font-semibold text-slate-800">
                            {normalizeText(employee.employment_status)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                ) : null}

                {activeTab === "personal" ? (
                  <div className="grid gap-3">
                    <div className="rounded-xl border border-slate-100 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Хүйс
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {normalizeText(employee.gender)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Нас
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {typeof employee.age === "number" &&
                        Number.isFinite(employee.age)
                          ? `${employee.age} нас`
                          : "Мэдээлэл байхгүй"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Имэйл
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {normalizeText(employee.email)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Гар утас
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {normalizeText(employee.phone_number)}
                      </p>
                    </div>
                  </div>
                ) : null}

                {activeTab === "documents" ? (
                  <div className="flex flex-col gap-4">
                    <div className="rounded-xl border border-slate-100 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        CV холбоос
                      </p>
                      {employee.cv_url ? (
                        <a
                          href={employee.cv_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-sky-600 transition hover:text-sky-700"
                        >
                          Баримт нээх →
                        </a>
                      ) : (
                        <p className="mt-2 text-sm font-medium text-slate-500">
                          Бичиг баримтын холбоос бүртгэгдээгүй байна.
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default ProfileModal;
