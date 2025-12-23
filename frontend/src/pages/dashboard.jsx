import { useEffect, useMemo, useState } from "react";
import apiClient from "../utils/apiClient";

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

function StatCard({ label, value, delta, icon, loading }) {
  return (
    <article className="rounded-[30px] bg-white p-6 shadow-lg mr-5">
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
  );
}

function WorkStatusChart({ data, loading }) {
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
              className="h-48 w-48 rounded-full border border-slate-100"
              style={{
                backgroundImage: `conic-gradient(${segments})`,
                boxShadow: "0 12px 24px rgba(2, 179, 255, 0.12)",
              }}
              role="img"
              aria-label="Ажлын төлөвийн тойм"
            />
            <ul className="grid w-full gap-2 text-sm text-slate-700 sm:grid-cols-3">
              {data.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.label}</span>
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatNumber(item.count)}
                  </span>
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
  return (
    <article className="rounded-[30px] bg-white p-6 shadow-lg">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Нас, хүйсийн бүтэц
          </h2>
        </div>
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
      </header>
      {loading ? (
        <span className="text-sm text-slate-500">Өгөгдөл татаж байна...</span>
      ) : data.length === 0 ? (
        <span className="text-sm text-slate-500">
          Нас, хүйсний мэдээлэл олдсонгүй.
        </span>
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((item) => {
            const maleWidth = item.malePercent;
            const femaleWidth = item.femalePercent;

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
                      {formatNumber(item.male)}
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
                      {formatNumber(item.female)}
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
                    {formatNumber(item.male)}
                  </span>
                  <span
                    className="flex items-center gap-1"
                    style={{ color: GENDER_COLORS.female }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: GENDER_COLORS.female }}
                    />
                    {formatNumber(item.female)}
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

function HiringCard({ name, role, date, avatar }) {
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

  return (
    <li className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 ">
      <div className="flex items-center gap-4">
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            className="h-12 w-12 rounded-full object-cover shadow"
          />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600 shadow">
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

  const stats = useMemo(
    () => [
      {
        id: "total-employees",
        label: "Нийт ажилчид",
        value: summary ? formatNumber(summary.employees?.total ?? 0) : "--",
        delta: summary
          ? `Байнгын: ${formatNumber(summary.employees?.permanent ?? 0)}`
          : "",
        icon: ICON_EMPLOYEES,
      },
      {
        id: "total-tasks",
        label: "Нийт даалгавар",
        value: summary ? formatNumber(summary.tasks?.total ?? 0) : "--",
        delta: summary
          ? `Дууссан: ${formatNumber(
              summary.tasks?.done ?? 0
            )} • Үргэлжилж буй: ${formatNumber(summary.tasks?.inProgress ?? 0)}`
          : "",
        icon: ICON_TASKS,
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
        label: "Дууссан",
        color: WORK_STATUS_COLORS.done,
        value: (done / total) * 100,
        count: done,
      },
      {
        label: "Ажиллаж байна",
        color: WORK_STATUS_COLORS.inProgress,
        value: (inProgress / total) * 100,
        count: inProgress,
      },
      {
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
          malePercent: `${(male / safeTotal) * 100}%`,
          femalePercent: `${(female / safeTotal) * 100}%`,
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
            <div className="flex flex-col justify-between  ">
              {stats.map((item) => (
                <StatCard
                  key={item.id}
                  label={item.label}
                  value={item.value}
                  delta={item.delta}
                  icon={item.icon}
                  loading={loading && !summary}
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
                Саяхан элссэн ажилчид
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
            <ul className="flex flex-col gap-3">
              {pipeline.map((candidate) => (
                <HiringCard key={candidate.id} {...candidate} />
              ))}
            </ul>
          )}
        </aside>
      </div>
    </section>
  );
}

export default Dashboard;
