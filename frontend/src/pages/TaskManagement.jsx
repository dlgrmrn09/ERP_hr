import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Pie, Bar } from "react-chartjs-2";
import ArrorIcon from "../assets/icons8-arrow.svg";
import ProfileAvatar from "../imgs/profile.jpg";
import apiClient from "../utils/apiClient.js";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);
const STATUS_META = {
  "Working On It": {
    label: "Ажиллаж байгаа",
    colorClass: "bg-cyan-300",
    chartColor: "#38BDF8",
  },
  Done: {
    label: "Дууссан",
    colorClass: "bg-emerald-400",
    chartColor: "#22C55E",
  },
  Stuck: {
    label: "Зогссон",
    colorClass: "bg-rose-500",
    chartColor: "#F43F5E",
  },
};

const FALLBACK_STATUS_META = {
  label: "Тодорхойгүй",
  colorClass: "bg-slate-300",
  chartColor: "#94A3B8",
};

const BOARD_COLORS = [
  "#22F48B",
  "#60DCFF",
  "#FF4747",
  "#F97316",
  "#A855F7",
  "#6366F1",
];

const normalizeStatusName = (value) => {
  if (!value) {
    return "";
  }
  const normalized = value.trim().toLowerCase();
  if (
    [
      "working on it",
      "working",
      "in progress",
      "progress",
      "pending",
      "open",
    ].includes(normalized)
  ) {
    return "Working On It";
  }
  if (["done", "completed", "complete", "finished"].includes(normalized)) {
    return "Done";
  }
  if (
    ["stuck", "blocked", "on hold", "paused", "stalled"].includes(normalized)
  ) {
    return "Stuck";
  }
  return value;
};

const REMAINDER_DATASET_LABEL = "Үлдэгдэл";

const INITIAL_OVERVIEW = {
  boards: [],
  workspaces: [],
  summary: {
    totalTasks: 0,
    inProgressTasks: 0,
    doneTasks: 0,
    stuckTasks: 0,
  },
  statusBreakdown: [],
  boardDistribution: [],
  feed: [],
};

const relativeTimeFormatter = (() => {
  if (
    typeof Intl === "undefined" ||
    typeof Intl.RelativeTimeFormat === "undefined"
  ) {
    return null;
  }
  try {
    return new Intl.RelativeTimeFormat("mn", { numeric: "auto" });
  } catch (error) {
    try {
      return new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    } catch {
      return null;
    }
  }
})();

const formatRelativeTime = (dateString) => {
  if (!dateString) {
    return "";
  }
  const targetDate = new Date(dateString);
  if (Number.isNaN(targetDate.getTime()) || !relativeTimeFormatter) {
    return "";
  }

  const diffMs = targetDate.getTime() - Date.now();
  const minutes = Math.round(diffMs / 60000);

  if (Math.abs(minutes) < 60) {
    return relativeTimeFormatter.format(minutes, "minute");
  }

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    return relativeTimeFormatter.format(hours, "hour");
  }

  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) {
    return relativeTimeFormatter.format(days, "day");
  }

  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) {
    return relativeTimeFormatter.format(months, "month");
  }

  const years = Math.round(months / 12);
  return relativeTimeFormatter.format(years, "year");
};

const formatFeedValue = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  try {
    return JSON.stringify(value);
  } catch (error) {
    return "";
  }
};

const formatFeedMessage = (item) => {
  const detail = item?.detail;
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((entry) => formatFeedValue(entry))
      .filter(Boolean)
      .join(" · ");
  }
  if (detail && typeof detail === "object") {
    const parts = [];
    const field = formatFeedValue(detail.field);
    if (field) {
      parts.push(field);
    }
    const from = formatFeedValue(detail.old_value);
    const to = formatFeedValue(detail.new_value);
    if (from || to) {
      parts.push(`${from || "—"} → ${to || "—"}`);
    }
    const timestamp = formatRelativeTime(detail.timestamp);
    if (timestamp) {
      parts.push(timestamp);
    }
    if (parts.length) {
      return parts.join(" · ");
    }
  }
  const fallback = [item?.action, item?.taskTitle].filter(Boolean).join(" · ");
  return fallback || "Шинэчлэлт";
};

function TaskManagement() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(INITIAL_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sectionsOpen, setSectionsOpen] = useState({
    recent: true,
    feed: true,
    workspace: true,
  });

  const handleWorkspaceCardClick = (workspaceId) => {
    const id = workspaceId ? String(workspaceId) : null;
    if (typeof window !== "undefined" && id) {
      window.sessionStorage.setItem("selectedWorkspaceId", id);
      window.dispatchEvent(
        new CustomEvent("workspace:selected", {
          detail: id,
        })
      );
    }
    navigate("/tasks/workspace");
  };

  useEffect(() => {
    let isMounted = true;

    const fetchOverview = async () => {
      setLoading(true);
      try {
        const { data } = await apiClient.get("/tasks/overview");
        if (!isMounted) {
          return;
        }

        const normalized = {
          ...INITIAL_OVERVIEW,
          boards: Array.isArray(data?.boards) ? data.boards : [],
          workspaces: Array.isArray(data?.workspaces) ? data.workspaces : [],
          summary: {
            ...INITIAL_OVERVIEW.summary,
            ...(data?.summary ?? {}),
          },
          statusBreakdown: Array.isArray(data?.statusBreakdown)
            ? data.statusBreakdown
            : [],
          boardDistribution: Array.isArray(data?.boardDistribution)
            ? data.boardDistribution
            : [],
          feed: Array.isArray(data?.feed) ? data.feed : [],
        };

        setOverview(normalized);
        setError(null);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        const message =
          err.response?.data?.message ?? "Даалгаврын мэдээлэл татаж чадсангүй.";
        setError(message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchOverview();

    return () => {
      isMounted = false;
    };
  }, []);

  const statusLegend = useMemo(
    () =>
      overview.statusBreakdown.map((item) => {
        const normalizedName = normalizeStatusName(item.name);
        const meta = STATUS_META[normalizedName] ?? FALLBACK_STATUS_META;
        return {
          name: item.name,
          label: meta.label ?? item.name ?? "Тодорхойгүй",
          colorClass: meta.colorClass ?? FALLBACK_STATUS_META.colorClass,
          chartColor: meta.chartColor ?? FALLBACK_STATUS_META.chartColor,
          count: item.count ?? 0,
        };
      }),
    [overview.statusBreakdown]
  );

  const statusLegendWithFallback =
    statusLegend.length > 0
      ? statusLegend
      : Object.entries(STATUS_META).map(([key, meta]) => ({
          name: key,
          label: meta.label,
          colorClass: meta.colorClass,
          chartColor: meta.chartColor,
          count: 0,
        }));

  const taskStatusData = useMemo(
    () => ({
      labels: statusLegendWithFallback.map((status) => status.label),
      datasets: [
        {
          data: statusLegendWithFallback.map((status) => status.count),
          backgroundColor: statusLegendWithFallback.map(
            (status) => status.chartColor
          ),
          borderColor: "#FFFFFF",
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    }),
    [statusLegendWithFallback]
  );

  const taskStatusOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#111827",
          bodyColor: "#F8FAFC",
          displayColors: false,
          padding: 10,
          cornerRadius: 8,
          titleFont: { family: "Inter, sans-serif", size: 12 },
          bodyFont: { family: "Inter, sans-serif", size: 12 },
        },
      },
    }),
    []
  );

  const totalBoardTasks = useMemo(
    () =>
      overview.boardDistribution.reduce((acc, board) => acc + board.count, 0),
    [overview.boardDistribution]
  );

  const taskBoardData = useMemo(() => {
    if (!overview.boardDistribution.length || totalBoardTasks === 0) {
      return {
        labels: ["boards"],
        datasets: [
          {
            label: "Өгөгдөл алга",
            data: [100],
            backgroundColor: "#E2E8F0",
            stack: "total",
            barThickness: 48,
          },
        ],
      };
    }

    const datasets = overview.boardDistribution.map((board, index) => ({
      label: board.name,
      data: [Math.round((board.count / totalBoardTasks) * 100)],
      backgroundColor: BOARD_COLORS[index % BOARD_COLORS.length],
      stack: "total",
      barThickness: 48,
    }));

    const used = datasets.reduce((acc, dataset) => acc + dataset.data[0], 0);
    const remainder = Math.max(100 - used, 0);
    if (remainder > 0 && remainder < 100) {
      datasets.push({
        label: REMAINDER_DATASET_LABEL,
        data: [remainder],
        backgroundColor: "#CBD5F5",
        stack: "total",
        barThickness: 48,
      });
    }

    return {
      labels: ["boards"],
      datasets,
    };
  }, [overview.boardDistribution, totalBoardTasks]);

  const taskBoardOptions = useMemo(
    () => ({
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 8, bottom: 8, left: 0, right: 0 },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          displayColors: false,
          backgroundColor: "#111827",
          bodyColor: "#F8FAFC",
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            title: () => "",
            label: (context) => {
              const { label = "" } = context.dataset;
              if (label === REMAINDER_DATASET_LABEL) {
                return null;
              }
              const value =
                typeof context.raw === "number"
                  ? context.raw
                  : Number(context.raw ?? 0);
              return Number.isFinite(value) ? `${label}: ${value}%` : "";
            },
          },
        },
      },
      scales: {
        x: {
          display: false,
          stacked: true,
          beginAtZero: true,
          max: 100,
          grid: { display: false, drawBorder: false },
          border: { display: false },
        },
        y: {
          display: false,
          stacked: true,
          grid: { display: false, drawBorder: false },
          border: { display: false },
        },
      },
      elements: {
        bar: {
          borderSkipped: false,
          borderRadius: (context) => {
            const lastIndex = context.chart.data.datasets.length - 1;
            if (context.datasetIndex === 0) {
              return { topLeft: 12, bottomLeft: 12 };
            }
            if (context.datasetIndex === lastIndex) {
              return { topRight: 12, bottomRight: 12 };
            }
            return 0;
          },
        },
      },
      interaction: {
        mode: "index",
        intersect: false,
      },
    }),
    []
  );

  const boardLegend = useMemo(() => {
    if (!overview.boardDistribution.length || totalBoardTasks === 0) {
      return [];
    }
    return overview.boardDistribution.map((board, index) => ({
      id: board.id,
      label: board.name,
      color: BOARD_COLORS[index % BOARD_COLORS.length],
      value: Math.round((board.count / totalBoardTasks) * 100),
    }));
  }, [overview.boardDistribution, totalBoardTasks]);

  const summaryCards = useMemo(
    () => [
      {
        id: "total",
        label: "Бүх даалгавар",
        value: overview.summary.totalTasks ?? 0,
      },
      {
        id: "inProgress",
        label: "Ажиллаж байгаа",
        value: overview.summary.inProgressTasks ?? 0,
      },
    ],
    [overview.summary]
  );

  const feedItems = useMemo(
    () =>
      overview.feed.map((item) => ({
        id: item.id,
        author: item.actorName ?? "Систем",
        message: formatFeedMessage(item),
        timeAgo: formatRelativeTime(item.createdAt) || "",
      })),
    [overview.feed]
  );

  const toggleSection = (key) => {
    setSectionsOpen((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="min-h-screen  px-4  sm:p-6 lg:px-8">
      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      <div className="flex w-full  flex-col gap-6 lg:flex-row">
        <main className="flex-1 space-y-6 bg-white p-6 rounded-[30px] shadow-lg">
          <section className="  bg-white/80 p-6 shadow-sm rounded-2xl ">
            <header className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => toggleSection("recent")}
                className="flex items-center gap-2 text-slate-900"
                aria-expanded={sectionsOpen.recent}
              >
                <img
                  src={ArrorIcon}
                  alt="Toggle recently visited section"
                  className={`h-4 w-4 transform cursor-pointer transition-transform duration-200 ${
                    sectionsOpen.recent ? "rotate-90" : "rotate-0"
                  }`}
                />
                <span className="text-lg font-semibold">
                  Саяхан Нэмсэн Ажилууд
                </span>
              </button>
            </header>
            {sectionsOpen.recent ? (
              loading ? (
                <p className="mt-6 text-sm text-slate-500">Ачаалж байна...</p>
              ) : overview.boards.length ? (
                <div className="mt-6 grid  gap-6 grid-cols-[repeat(auto-fill,_minmax(280px,_310px))]">
                  {overview.boards.map((board) => (
                    <Link
                      key={board.id}
                      to={`/tasks/boards/${board.id}`}
                      state={{ boardName: board.name || "Нэргүй самбар" }}
                    >
                      <article className="rounded-2xl border border-slate-200 bg-white transition hover:shadow-lg hover:-translate-y-1 cursor-pointer">
                        <img
                          src="https://cdn.monday.com/images/quick_search_recent_board2.svg"
                          alt=""
                          aria-hidden="true"
                          className="h-40 w-full rounded-t-2xl object-cover"
                        />
                        <div className="flex items-start gap-3 p-4">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-sm font-semibold text-white">
                            {board.name?.slice(0, 1)?.toUpperCase() ?? "B"}
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-slate-900">
                              {board.name}
                            </h3>
                            <p className="mt-1 text-xs text-slate-500">
                              Workspace · {board.workspaceName ?? "Тодорхойгүй"}
                            </p>
                          </div>
                        </div>
                      </article>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-6 text-sm text-slate-500">
                  Самбарын мэдээлэл олдсонгүй.
                </p>
              )
            ) : null}
          </section>

          <section className=" bg-white/80 p-6 shadow-sm rounded-2xl ">
            <header className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <button
                type="button"
                onClick={() => toggleSection("feed")}
                className="flex items-center gap-2"
                aria-expanded={sectionsOpen.feed}
              >
                <img
                  src={ArrorIcon}
                  alt="Toggle update feed"
                  className={`h-4 w-4 transform cursor-pointer transition-transform duration-200 ${
                    sectionsOpen.feed ? "rotate-90" : "rotate-0"
                  }`}
                />
                <span>Шинэ мэдээлэл</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                  {feedItems.length}
                </span>
              </button>
            </header>
            {sectionsOpen.feed ? (
              loading ? (
                <p className="text-sm text-slate-500">Ачаалж байна...</p>
              ) : feedItems.length ? (
                <ul className="space-y-4 border border-slate-200 p-4 rounded-2xl overflow-y-auto h-50 bg-white">
                  {feedItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start gap-4 bg-white p-4 border-b border-slate-200 cursor-pointer"
                    >
                      <img
                        src={ProfileAvatar}
                        alt=""
                        aria-hidden="true"
                        className="h-12 w-12 rounded-full"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm text-slate-500">
                          <span className="font-medium text-slate-900">
                            {item.author}
                          </span>
                          <time>{item.timeAgo}</time>
                        </div>
                        <p className="mt-2 text-sm text-slate-700">
                          {item.message}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">
                  Шинэчлэлтийн түүх алга байна.
                </p>
              )
            ) : null}
          </section>

          <section className=" bg-white/80 p-6 shadow-sm rounded-2xl ">
            <div className="flex items-center mb-4 gap-2">
              <button
                type="button"
                onClick={() => toggleSection("workspace")}
                className="flex items-center gap-2"
                aria-expanded={sectionsOpen.workspace}
              >
                <img
                  src={ArrorIcon}
                  alt="Toggle workspace section"
                  className={`h-4 w-4 transform cursor-pointer transition-transform duration-200 ${
                    sectionsOpen.workspace ? "rotate-90" : "rotate-0"
                  }`}
                />
                <span className=" text-lg font-semibold text-slate-900">
                  Workspace
                </span>
              </button>
            </div>
            {sectionsOpen.workspace ? (
              loading ? (
                <p className="text-sm text-slate-500">Ачаалж байна...</p>
              ) : overview.workspaces.length ? (
                <div className="grid gap-4 sm:grid-cols-2 ">
                  {overview.workspaces.map((workspace) => (
                    <div
                      key={workspace.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-lg hover:-translate-y-1 cursor-pointer"
                      onClick={() => handleWorkspaceCardClick(workspace.id)}
                    >
                      <div className="flex items-center gap-3 ">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-base font-semibold text-white">
                          {workspace.name?.slice(0, 1)?.toUpperCase() ?? "W"}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {workspace.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {workspace.description || "Тайлбар байхгүй"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Workspace мэдээлэл олдсонгүй.
                </p>
              )
            ) : null}
          </section>
        </main>

        <aside className="flex w-full flex-col gap-6 lg:w-80">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
            <h3 className="text-base font-semibold text-slate-900">
              Ажлийн үйл явц
            </h3>
            <div className="mt-6 flex items-center justify-center">
              <div className="relative h-32 w-32">
                <Pie data={taskStatusData} options={taskStatusOptions} />
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              {statusLegendWithFallback.map((status) => (
                <li key={status.name} className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${status.colorClass}`}
                  />
                  {status.label}
                  <span className="ml-auto text-xs text-slate-400">
                    {status.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {summaryCards.map((stat) => (
            <div
              key={stat.id}
              className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-lg"
            >
              <p className="text-sm text-slate-500">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {stat.value}
              </p>
            </div>
          ))}

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
            <h3 className="text-base font-semibold text-slate-900">
              Самбарын Тархалт
            </h3>
            <div
              className="mt-6 overflow-hidden rounded-[10px]  bg-white/80 p-2"
              style={{ borderColor: "#333333" }}
            >
              <div className="h-24">
                <Bar data={taskBoardData} options={taskBoardOptions} />
              </div>
            </div>
            {boardLegend.length ? (
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
                {boardLegend.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-2"
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.label}
                    <span className="text-slate-400">{item.value}%</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-xs text-slate-500">
                Самбаруудаар ангилсан өгөгдөл алга байна.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default TaskManagement;
