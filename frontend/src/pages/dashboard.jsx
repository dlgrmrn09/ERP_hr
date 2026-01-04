import { useEffect, useMemo, useState } from "react";
import apiClient from "../utils/apiClient";
import { Link, useNavigate } from "react-router-dom";
import ProfileModal from "../components/Profile.jsx";

const ICON_EMPLOYEES =
  "https://www.figma.com/api/mcp/asset/e34c8037-bafd-4c73-a14f-26d998d8cf60";
const ICON_TASKS =
  "https://www.figma.com/api/mcp/asset/5d821cfb-0013-4bca-825d-6f78454c14ea";

const WORK_STATUS_COLORS = {
  done: "#02b3ff",
  inProgress: "#fd2aef",
  stuck: "#ff5d5d",
};

const formatNumber = (value) =>
  new Intl.NumberFormat("mn-MN").format(Number.isFinite(value) ? value : 0);

const formatDate = (value) => {
  if (!value) {
    return "Огноо тодорхойгүй";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Огноо тодорхойгүй";
  }
  return new Intl.DateTimeFormat("mn-MN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
};

const GENDER_COLORS = {
  male: "#02b3ff",
  female: "#fd2aef",
};

const parseCount = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

// Scrollable overview mimics the wide Figma frame while staying data-driven.
function OverviewScrollable({
  loading,
  employeeTypes,
  timeMetrics,
  documentMetrics,
  taskSummary,
  attendanceBreakdown,
  tasksByOwner,
}) {
  const totalEmployees = employeeTypes.reduce(
    (acc, item) => acc + item.count,
    0
  );

  let accumulated = 0;
  const donutSegments = employeeTypes
    .map((item) => {
      const portion = totalEmployees ? (item.count / totalEmployees) * 100 : 0;
      const start = accumulated;
      accumulated += portion;
      const end = Math.min(start + portion, 100);
      return `${item.color} ${start}% ${end}%`;
    })
    .join(", ");

  const maxOwnerCount = tasksByOwner.reduce(
    (max, item) => Math.max(max, item.count),
    0
  );

  return (
    <section className="mt-6">
      <div className="overflow-x-auto pb-4">
        <div className="min-w-275 rounded-[30px]  ">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <article className="rounded-[30px] bg-white p-6 shadow-lg">
              <header className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">
                  Ажилчдын төрөл
                </h2>
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-[#191E21] text-white"
                  aria-label="More options"
                >
                  <span>•••</span>
                </button>
              </header>
              <div className="flex flex-col items-center gap-4">
                <div className="relative h-52 w-52">
                  <div
                    className="absolute inset-0 rounded-full border border-slate-100"
                    style={{
                      background: donutSegments
                        ? `conic-gradient(${donutSegments})`
                        : "#f8fafc",
                    }}
                    role="img"
                    aria-label="Ажилчдын төрөл"
                  />
                  <div className="absolute inset-[22%] flex items-center justify-center rounded-full bg-white text-center shadow-inner">
                    <span className="text-2xl font-bold text-slate-900">
                      {loading ? "--" : formatNumber(totalEmployees)}
                    </span>
                  </div>
                </div>
                <ul className="flex flex-col gap-2 text-sm text-slate-700">
                  {employeeTypes.map((item) => (
                    <li key={item.id} className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-medium">{item.label}</span>
                      <span className="text-xs text-slate-500">
                        {loading ? "--" : formatNumber(item.count)}
                      </span>
                    </li>
                  ))}
                  {employeeTypes.length === 0 && !loading && (
                    <li className="text-xs text-slate-500">
                      Өгөгдөл олдсонгүй.
                    </li>
                  )}
                </ul>
              </div>
            </article>
            <article className="rounded-[30px] bg-white p-6 shadow-lg">
              <Link to="/time-tracking">
                <header className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-900">
                    Цагын бүртгэл
                  </h2>
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-[#191E21] text-white"
                    aria-label="More options"
                  >
                    <span>•••</span>
                  </button>
                </header>
                <dl className="flex flex-col gap-3 text-sm text-slate-700">
                  {timeMetrics.map((metric) => (
                    <div
                      key={metric.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-2"
                    >
                      <dt className="font-medium">{metric.label}</dt>
                      <dd className="text-slate-900">
                        {loading ? "--" : metric.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Link>
            </article>

            <article className="rounded-[30px] bg-white p-6 shadow-lg">
              <header className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">
                  Бичиг баримт
                </h2>
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-[#191E21] text-white"
                  aria-label="More options"
                >
                  <span>•••</span>
                </button>
              </header>
              <dl className="flex flex-col gap-3 text-sm text-slate-700">
                {documentMetrics.map((metric) => (
                  <div
                    key={metric.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-2"
                  >
                    <dt className="font-medium">{metric.label}</dt>
                    <dd className="text-slate-900">
                      {loading ? "--" : metric.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {taskSummary.map((item) => (
              <article
                key={item.id}
                className="flex flex-col items-center justify-between rounded-[30px] bg-white p-6 text-center shadow-lg"
              >
                <header className="mb-2 flex w-full items-center justify-between text-sm text-slate-500">
                  <span>{item.label}</span>
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-[#191E21] text-white"
                    aria-label="More options"
                  >
                    <span>•••</span>
                  </button>
                </header>
                <p className="text-3xl font-bold text-slate-900">
                  {loading ? "--" : item.value}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <article className="rounded-[30px] bg-white p-6 shadow-lg">
              <header className="mb-4 text-xl font-semibold text-slate-900">
                Ирцийн тойм
              </header>
              {loading && attendanceBreakdown.length === 0 ? (
                <p className="text-sm text-slate-500">Өгөгдөл татаж байна...</p>
              ) : attendanceBreakdown.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Ирцийн мэдээлэл олдсонгүй.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex h-24 overflow-hidden rounded-3xl border border-slate-200">
                    {attendanceBreakdown.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-center text-sm font-semibold text-white"
                        style={{
                          width: item.percent,
                          backgroundColor: item.color,
                        }}
                      >
                        <span>
                          {(() => {
                            const percentValue = Number.parseFloat(
                              item.percent
                            );
                            if (loading) {
                              return "--";
                            }
                            return Number.isFinite(percentValue) &&
                              percentValue >= 5
                              ? item.percent
                              : "";
                          })()}
                        </span>
                      </div>
                    ))}
                  </div>
                  <ul className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    {attendanceBreakdown.map((item) => (
                      <li key={item.id} className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-medium">{item.label}</span>
                        <span className="text-slate-500">
                          {loading
                            ? "--"
                            : `${formatNumber(item.count)} • ${item.percent}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>

            <article className="rounded-[30px] bg-white p-6 shadow-lg">
              <header className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">
                  Даалгавар
                </h2>
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-[#191E21] text-white"
                  aria-label="More options"
                >
                  <span>•••</span>
                </button>
              </header>
              {loading ? (
                <p className="text-sm text-slate-500">Өгөгдөл татаж байна...</p>
              ) : tasksByOwner.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Даалгаврын эзэмшигчийн мэдээлэл алга.
                </p>
              ) : (
                <ul className="flex flex-col gap-3 text-sm text-slate-700">
                  {tasksByOwner.map((item) => (
                    <li key={item.label}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{item.label}</span>
                        <span className="text-xs text-slate-500">
                          {loading ? "--" : formatNumber(item.count)}
                        </span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: maxOwnerCount
                              ? `${(item.count / maxOwnerCount) * 100}%`
                              : "0%",
                            backgroundColor: "#cbd5f5",
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value, delta, icon, loading, to }) {
  return (
    <Link to={to || "/"}>
      <article className="rounded-[30px] bg-white p-6 shadow-lg mr-5 cursor-pointer hover:shadow-xl hover:translate-y-[-5px]">
        <div className="flex items-start justify-between">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
            <img src={icon} alt="" className="h-6 w-6" />
          </span>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-full  bg-[#191E21] text-white cursor-pointer"
            aria-label="More options"
          >
            <span className="text-m">•••</span>
          </button>
        </div>
        <p className="mt-4 text-lg font-medium text-slate-900">{label}</p>
        <p className="mt-2 text-3xl font-bold text-slate-900">
          {loading ? "--" : value}
        </p>
        <p className="mt-3 text-sm text-slate-500">
          {loading ? "Өгөгдөл татаж байна..." : delta}
        </p>
      </article>
    </Link>
  );
}

function WorkStatusChart({ data, loading }) {
  const navigate = useNavigate();
  const handleNavigate = (status) => {
    const params = new URLSearchParams({ group: "status" });
    if (status) {
      params.set("status", status);
    }
    navigate(`/tasks/all-tasks?${params.toString()}`);
  };

  const segments = data
    .map((item, index) => {
      const start = data
        .slice(0, index)
        .reduce((sum, curr) => sum + curr.value, 0);
      const end = start + item.value;
      return `${item.color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <article className="flex h-full flex-col rounded-[30px] bg-white px-10 py-8 shadow-lg ">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900 ">Ажлын төлөв</h2>
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-full  bg-[#191E21] text-white cursor-pointer"
          aria-label="More options"
        >
          <span className="text-m">•••</span>
        </button>
      </header>
      <div className="mt-6 flex flex-1 flex-col items-center justify-center gap-6">
        {loading ? (
          <span className="text-sm text-slate-500">Өгөгдөл татаж байна...</span>
        ) : data.length === 0 ? (
          <span className="text-sm text-slate-500">Мэдээлэл олдсонгүй.</span>
        ) : (
          <>
            <div
              className="h-48 w-48 cursor-pointer rounded-full border border-slate-100"
              style={{
                backgroundImage: `conic-gradient(${segments})`,
                boxShadow: "0 12px 24px rgba(2, 179, 255, 0.12)",
              }}
              role="img"
              aria-label="Ажлын төлөвийн тойм"
              tabIndex={0}
              onClick={() => handleNavigate()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleNavigate();
                }
              }}
            />
            <ul className="flex justify-center w-full gap-2 text-sm text-slate-700 sm:grid-cols-3">
              {data.map((item) => (
                <li key={item.label} className="flex">
                  <button
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    className="flex w-full items-center  gap-2 rounded-xl border border-transparent px-3 py-2 text-left transition hover:border-slate-200 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span>{item.label}</span>
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {formatNumber(item.count)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </article>
  );
}

function AgeGenderDistributionBlock({ data, loading }) {
  const [viewMode, setViewMode] = useState("count");
  const totals = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return {
        totalMale: 0,
        totalFemale: 0,
        maleShare: "0",
        femaleShare: "0",
        ratio: "--",
      };
    }
    const totalMale = data.reduce((sum, item) => sum + (item.male ?? 0), 0);
    const totalFemale = data.reduce((sum, item) => sum + (item.female ?? 0), 0);
    const grandTotal = totalMale + totalFemale || 1;
    const ratio = totalFemale > 0 ? (totalMale / totalFemale).toFixed(2) : "∞";
    return {
      totalMale,
      totalFemale,
      maleShare: ((totalMale / grandTotal) * 100).toFixed(0),
      femaleShare: ((totalFemale / grandTotal) * 100).toFixed(0),
      ratio,
    };
  }, [data]);

  return (
    <article className="rounded-[30px] bg-white p-6 shadow-lg">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Нас, хүйсийн бүтэц
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <span
              className="flex items-center gap-2 font-semibold"
              style={{ color: GENDER_COLORS.male }}
            >
              <span
                className="h-2.5 w-6 rounded-full"
                style={{ backgroundColor: GENDER_COLORS.male }}
              />
              Эрэгтэй
            </span>
            <span
              className="flex items-center gap-2 font-semibold"
              style={{ color: GENDER_COLORS.female }}
            >
              <span
                className="h-2.5 w-6 rounded-full"
                style={{ backgroundColor: GENDER_COLORS.female }}
              />
              Эмэгтэй
            </span>
          </div>
          <div className="inline-flex rounded-full bg-white p-1 text-xs font-medium text-slate-600 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode("count")}
              className={`rounded-full px-3 py-1 transition ${
                viewMode === "count"
                  ? "bg-[#191e21] text-white shadow-sm"
                  : "hover:text-slate-900"
              }`}
            >
              Тоо
            </button>
            <button
              type="button"
              onClick={() => setViewMode("percent")}
              className={`rounded-full px-3 py-1 transition ${
                viewMode === "percent"
                  ? "bg-[#191e21] text-white shadow-sm"
                  : "hover:text-slate-900"
              }`}
            >
              Хувь
            </button>
          </div>
        </div>
      </header>
      {loading ? (
        <span className="text-sm text-slate-500">Өгөгдөл татаж байна...</span>
      ) : data.length === 0 ? (
        <span className="text-sm text-slate-500">
          Нас, хүйсний мэдээлэл олдсонгүй.
        </span>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-2xl  px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Нийт эрэгтэй
              </p>
              <p className="mt-2 flex items-baseline gap-2 text-xl font-bold text-slate-900">
                {formatNumber(totals.totalMale)}
                <span className="text-xs font-medium text-slate-500">
                  {totals.maleShare}%
                </span>
              </p>
            </div>
            <div className="rounded-2xl  px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Нийт эмэгтэй
              </p>
              <p className="mt-2 flex items-baseline gap-2 text-xl font-bold text-slate-900">
                {formatNumber(totals.totalFemale)}
                <span className="text-xs font-medium text-slate-500">
                  {totals.femaleShare}%
                </span>
              </p>
            </div>
            <div className="rounded-2xl  px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Харьцаа
              </p>
              <p className="mt-2 text-xl font-bold text-slate-900">
                {totals.ratio}
              </p>
              <p className="text-xs font-medium text-slate-500">
                Эрэгтэй : Эмэгтэй
              </p>
            </div>
          </div>
          {data.map((item) => {
            const maleWidth = item.malePercent;
            const femaleWidth = item.femalePercent;
            const maleDisplay =
              viewMode === "count" ? formatNumber(item.male) : item.malePercent;
            const femaleDisplay =
              viewMode === "count"
                ? formatNumber(item.female)
                : item.femalePercent;

            return (
              <div
                key={item.label}
                className="grid items-center gap-4 text-sm font-semibold text-slate-700 sm:grid-cols-[120px_minmax(0,1fr)_120px]"
              >
                <span className="truncate">{item.label}</span>
                <div className="relative flex h-6 overflow-hidden rounded-full bg-slate-100">
                  {item.male > 0 && (
                    <span
                      className="flex items-center justify-start px-3 text-xs font-semibold text-white"
                      style={{
                        width: maleWidth,
                        backgroundColor: GENDER_COLORS.male,
                      }}
                    >
                      {viewMode === "count"
                        ? formatNumber(item.male)
                        : item.malePercent}
                    </span>
                  )}
                  {item.female > 0 && (
                    <span
                      className="flex items-center justify-end px-3 text-xs font-semibold text-white"
                      style={{
                        width: femaleWidth,
                        backgroundColor: GENDER_COLORS.female,
                      }}
                    >
                      {viewMode === "count"
                        ? formatNumber(item.female)
                        : item.femalePercent}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-end gap-3 text-xs font-medium text-slate-500">
                  <span
                    className="flex items-center gap-1"
                    style={{ color: GENDER_COLORS.male }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: GENDER_COLORS.male }}
                    />
                    {maleDisplay}
                  </span>
                  <span
                    className="flex items-center gap-1"
                    style={{ color: GENDER_COLORS.female }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: GENDER_COLORS.female }}
                    />
                    {femaleDisplay}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function HiringCard({ id, name, role, date, avatar, onSelect }) {
  let initials = "?";
  if (name) {
    initials = name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  const handleSelect = () => {
    if (!id || typeof onSelect !== "function") {
      return;
    }
    onSelect(id);
  };

  return (
    <li
      className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 cursor-pointer hover:shadow-md hover:translate-y-[-5px]"
      onClick={handleSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleSelect();
        }
      }}
    >
      <div className="flex items-center gap-4">
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            className="h-12 w-12 shrink-0 rounded-full object-cover shadow"
          />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-200 text-base font-semibold text-slate-600 shadow">
            {initials}
          </span>
        )}
        <div>
          <p className="text-sm font-semibold text-slate-900">{name}</p>
          <p className="text-xs font-medium text-slate-500">{role}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span>{date}</span>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-400">
          <svg
            aria-hidden="true"
            className="h-3.5 w-3.5"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4 2.5 7.5 6 4 9.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </li>
  );
}

function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        setLoading(true);
        const [summaryResponse, employeesResponse] = await Promise.all([
          apiClient.get("/dashboard/summary", {
            signal: controller.signal,
          }),
          apiClient.get("/employees", {
            params: {
              page: 1,
              pageSize: 7,
              sort: "start_date",
              order: "desc",
            },
            signal: controller.signal,
          }),
        ]);

        if (!isMounted) {
          return;
        }
        console.log(summaryResponse.data);
        setSummary(summaryResponse.data ?? null);
        setEmployees(employeesResponse.data?.data ?? []);
        setError(null);
      } catch (err) {
        if (!isMounted) {
          return;
        }

        if (err.code === "ERR_CANCELED") {
          return;
        }

        const message =
          err.response?.data?.message ?? "Өгөгдөл татах явцад алдаа гарлаа.";
        setError(message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const openProfileModal = (employeeId) => {
    if (!employeeId) {
      return;
    }
    setSelectedEmployeeId(employeeId);
    setIsProfileOpen(true);
  };

  const closeProfileModal = () => {
    setIsProfileOpen(false);
    setSelectedEmployeeId(null);
  };

  const stats = useMemo(
    () => [
      {
        id: "total-employees",
        label: "Нийт ажилчид",
        value: summary ? formatNumber(summary.employees?.total ?? 0) : "--",
        delta: summary
          ? `үндсэн: ${formatNumber(summary.employees?.permanent ?? 0)} `
          : "",
        icon: ICON_EMPLOYEES,
        link: "/employees",
      },
      {
        id: "total-tasks",
        label: "Ажилын Төлөвлөгөө",
        value: summary ? formatNumber(summary.tasks?.total ?? 0) : "--",
        delta: summary
          ? `Дууссан: ${formatNumber(
              summary.tasks?.done ?? 0
            )} • Үргэлжилж буй: ${formatNumber(summary.tasks?.inProgress ?? 0)}`
          : "",
        icon: ICON_TASKS,
        link: "/tasks/all-tasks",
      },
    ],
    [summary]
  );

  const workStatusData = useMemo(() => {
    if (!summary) {
      return [];
    }
    const done = summary.tasks?.done ?? 0;
    const inProgress = summary.tasks?.inProgress ?? 0;
    const stuck = summary.tasks?.stuck ?? 0;
    const total = done + inProgress + stuck;
    if (total === 0) {
      return [];
    }
    return [
      {
        id: "done",
        label: "Дууссан",
        color: WORK_STATUS_COLORS.done,
        value: (done / total) * 100,
        count: done,
      },
      {
        id: "inProgress",
        label: "Ажиллаж байна",
        color: WORK_STATUS_COLORS.inProgress,
        value: (inProgress / total) * 100,
        count: inProgress,
      },
      {
        id: "stuck",
        label: "Гацсан",
        color: WORK_STATUS_COLORS.stuck,
        value: (stuck / total) * 100,
        count: stuck,
      },
    ];
  }, [summary]);

  const ageGenderDistribution = useMemo(() => {
    const rawData =
      summary?.demographics?.ageGender ??
      summary?.employees?.ageGenderDistribution ??
      summary?.employees?.ageGender ??
      [];

    if (!Array.isArray(rawData)) {
      return [];
    }

    return rawData
      .map((item, index) => {
        const male = parseCount(
          item.male ?? item.maleCount ?? item.m ?? item.males
        );
        const female = parseCount(
          item.female ?? item.femaleCount ?? item.f ?? item.females
        );
        const total = male + female;
        const safeTotal = total === 0 ? 1 : total;
        const label =
          item.label ?? item.ageRange ?? item.group ?? `Бүлэг ${index + 1}`;
        return {
          label,
          male,
          female,
          malePercent: `${((male / safeTotal) * 100).toFixed(0)}%`,
          femalePercent: `${((female / safeTotal) * 100).toFixed(0)}%`,
        };
      })
      .filter((item) => Number.isFinite(item.male + item.female))
      .filter((item) => item.male + item.female > 0);
  }, [summary]);

  const pipeline = useMemo(
    () =>
      employees.map((employee) => {
        const nameParts = [employee.last_name, employee.first_name].filter(
          Boolean
        );
        return {
          id: employee.id,
          name:
            nameParts.length > 0 ? nameParts.join(" ") : employee.employee_code,
          role: employee.position_title || "Албан тушаал байхгүй",
          date: formatDate(employee.start_date),
          avatar: employee.avatar_url ?? null,
        };
      }),
    [employees]
  );

  const employeeTypeDistribution = useMemo(() => {
    const total = parseCount(summary?.employees?.total);
    const permanent = parseCount(summary?.employees?.permanent);
    const interns = parseCount(summary?.employees?.interns);
    const contract = Math.max(total - permanent - interns, 0);
    return [
      {
        id: "contract",
        label: "Гэрээт",
        count: contract,
        color: "#FFB411",
      },
      {
        id: "permanent",
        label: "Үндсэн",
        count: permanent,
        color: "#22F48B",
      },
      {
        id: "intern",
        label: "Дадлага",
        count: interns,
        color: "#0AA4FF",
      },
    ].filter((item) => item.count > 0);
  }, [summary]);

  const timeMetrics = useMemo(
    () => [
      {
        id: "total",
        label: "Нийт ажилтан",
        value: formatNumber(summary?.employees?.total ?? 0),
      },
      {
        id: "late",
        label: "Хоцролт (тоо)",
        value: formatNumber(summary?.attendance?.late ?? 0),
      },
      {
        id: "absent",
        label: "Тасалсан",
        value: formatNumber(summary?.attendance?.absent ?? 0),
      },
      {
        id: "overtime",
        label: "Илүү цаг (мин)",
        value: formatNumber(summary?.attendance?.overtimeMinutes ?? 0),
      },
      {
        id: "leave",
        label: "Амралт, чөлөө",
        value: summary?.attendance?.leave
          ? formatNumber(summary.attendance.leave)
          : "--",
      },
    ],
    [summary]
  );

  const documentMetrics = useMemo(
    () => [
      {
        id: "total-docs",
        label: "Нийт бичиг баримт",
        value: formatNumber(summary?.documents?.total ?? 0),
      },
      {
        id: "incoming-docs",
        label: "Ирсэн бичиг баримт",
        value: summary?.documents?.incoming
          ? formatNumber(summary.documents.incoming)
          : "--",
      },
      {
        id: "outgoing-docs",
        label: "Явуулсан бичиг баримт",
        value: summary?.documents?.outgoing
          ? formatNumber(summary.documents.outgoing)
          : "--",
      },
      {
        id: "pending-docs",
        label: "Шийдэгдээгүй",
        value: summary?.documents?.pending
          ? formatNumber(summary.documents.pending)
          : "--",
      },
      {
        id: "resolved-docs",
        label: "Шийдэгдсэн",
        value: summary?.documents?.resolved
          ? formatNumber(summary.documents.resolved)
          : "--",
      },
    ],
    [summary]
  );

  const taskSummaryCards = useMemo(
    () => [
      {
        id: "all",
        label: "Өнөөдрийн Ирц",
        value: formatNumber(summary?.attendance?.daily[0]?.on_time ?? 0),
      },
      {
        id: "in-progress",
        label: "Ажиллаж буй",
        value: formatNumber(summary?.tasks?.inProgress ?? 0),
      },
      {
        id: "stuck",
        label: "Саатсан",
        value: formatNumber(summary?.tasks?.stuck ?? 0),
      },
      {
        id: "done",
        label: "Дууссан",
        value: formatNumber(summary?.tasks?.done ?? 0),
      },
    ],
    [summary]
  );

  const attendanceBreakdown = useMemo(() => {
    const late = parseCount(summary?.attendance?.late);
    const absent = parseCount(summary?.attendance?.absent);
    const total = parseCount(summary?.employees?.total);
    const present = Math.max(total - late - absent, 0);
    const overall = late + absent + present;
    if (overall === 0) {
      return [];
    }
    const toPercent = (value) => `${((value / overall) * 100).toFixed(2)}%`;
    return [
      {
        id: "present",
        label: "Ирсэн",
        count: present,
        percent: toPercent(present),
        color: "#22F48B",
      },
      {
        id: "late",
        label: "Хоцорсон",
        count: late,
        percent: toPercent(late),
        color: "#FFB411",
      },
      {
        id: "absent",
        label: "Тасалсан",
        count: absent,
        percent: toPercent(absent),
        color: "#FF4747",
      },
    ];
  }, [summary]);

  const tasksByOwner = useMemo(() => {
    const rows = Array.isArray(summary?.tasks?.recent)
      ? summary.tasks.recent
      : [];
    if (!rows.length) {
      return [];
    }
    const counts = rows.reduce((acc, task) => {
      const label = task.board_name ?? "Тодорхойгүй";
      acc[label] = (acc[label] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [summary]);

  return (
    <section className="px-6 pb-12">
      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <div className="grid gap-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
            <div className="flex flex-col gap-4 ">
              {stats.map((item) => (
                <StatCard
                  key={item.id}
                  label={item.label}
                  value={item.value}
                  delta={item.delta}
                  icon={item.icon}
                  loading={loading && !summary}
                  to={item.link}
                />
              ))}
            </div>
            <WorkStatusChart
              data={workStatusData}
              loading={loading && !summary}
            />
          </div>
          <AgeGenderDistributionBlock
            data={ageGenderDistribution}
            loading={loading && !summary}
          />
        </div>
        <aside className="rounded-[30px] bg-white p-6 shadow-lg">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Саяхан нэмэгдсэн ажилтан
              </h2>
            </div>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-full  bg-[#191E21] text-white cursor-pointer"
              aria-label="More options"
            >
              <span className="text-m">•••</span>
            </button>
          </header>
          {loading && !employees.length ? (
            <span className="text-sm text-slate-500">
              Өгөгдөл татаж байна...
            </span>
          ) : pipeline.length === 0 ? (
            <span className="text-sm text-slate-500">
              Саяхан нэмэгдсэн ажилчид алга.
            </span>
          ) : (
            <ul className="flex flex-col gap-3 ">
              {pipeline.map((candidate) => (
                <HiringCard
                  key={candidate.id}
                  {...candidate}
                  onSelect={openProfileModal}
                />
              ))}
            </ul>
          )}
        </aside>
      </div>
      <OverviewScrollable
        loading={loading && !summary}
        employeeTypes={employeeTypeDistribution}
        timeMetrics={timeMetrics}
        documentMetrics={documentMetrics}
        taskSummary={taskSummaryCards}
        attendanceBreakdown={attendanceBreakdown}
        tasksByOwner={tasksByOwner}
      />
      <ProfileModal
        isOpen={isProfileOpen}
        employeeId={selectedEmployeeId}
        onClose={closeProfileModal}
      />
    </section>
  );
}

export default Dashboard;
