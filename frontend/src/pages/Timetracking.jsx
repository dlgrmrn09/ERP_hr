import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useId,
  useRef,
} from "react";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import apiClient from "../utils/apiClient";
import WhiteButton from "../components/WhiteButton";
import Searchbar from "../components/Searchbar";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const STATUS_LABELS = {
  "On Time": "Ирсэн",
  Late: "Хоцорсон",
  Absent: "Тасалсан",
};

const STATUS_COLORS = {
  "On Time": "#22F48B",
  Late: "#FFB411",
  Absent: "#FF4747",
};

const CHART_STATUS_COLORS = {
  "On Time": "#22F48B",
  Late: "#FF4747",
  Absent: "#FACC15",
};

const STATUS_ORDER = ["On Time", "Late", "Absent"];

const SORT_OPTIONS = [
  { value: "date", label: "Огноо" },
  { value: "lateness", label: "Хоцролт" },
];

const GROUP_OPTIONS = [
  { value: "none", label: "Бүгд" },
  { value: "status", label: "Статус" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 40];

const WEEKDAY_LABELS = ["Дав", "Мяг", "Лха", "Пүр", "Баа", "Бям", "Ням"];

const EMPTY_STATUS_COUNTS = Object.freeze({
  "On Time": 0,
  Late: 0,
  Absent: 0,
});

const QUICK_MONTH_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const normalizeStatus = (value) =>
  STATUS_ORDER.includes(value) ? value : "On Time";

const formatMinutesLate = (value) => {
  const minutes = Number(value ?? 0);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "0 мин";
  }
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours} цаг`;
    }
    return `${hours} цаг ${remainingMinutes} мин`;
  }
  return `${minutes} мин`;
};

const formatOvertime = (value) => {
  const minutes = Number(value ?? 0);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "Байхгүй";
  }
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours} цаг`;
    }
    return `${hours} цаг ${remainingMinutes} мин`;
  }
  return `${minutes} мин`;
};

const formatNumber = (value) =>
  new Intl.NumberFormat("mn-MN").format(Number.isFinite(value) ? value : 0);

const buildMonthKey = (date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;

const buildDateKey = (date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(
    2,
    "0"
  )}-${`${date.getDate()}`.padStart(2, "0")}`;

function TimeTracking() {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState("date");
  const [sortDirection, setSortDirection] = useState("desc");
  const [groupBy, setGroupBy] = useState("none");
  const [activeView, setActiveView] = useState("table");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return buildMonthKey(today);
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [selectedQuickMonths, setSelectedQuickMonths] = useState(
    () => new Set()
  );
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
  const monthInputId = useId();
  const monthInputRef = useRef(null);

  const currentMonthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);

  const currentMonthKey = useMemo(
    () => buildMonthKey(currentMonthStart),
    [currentMonthStart]
  );

  const percentCalculator = useCallback((part, total) => {
    const partNum = Number(part);
    const totalNum = Number(total);
    if (
      !Number.isFinite(partNum) ||
      !Number.isFinite(totalNum) ||
      totalNum === 0
    ) {
      return "0%";
    }
    return `${((partNum / totalNum) * 100).toFixed(1)}%`;
  }, []);

  const selectedYearNumber = useMemo(() => {
    const [yearPart] = selectedMonth.split("-");
    const parsed = Number(yearPart);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [selectedMonth]);

  const selectedMonthNumber = useMemo(() => {
    const [, monthPart] = selectedMonth.split("-");
    const parsed = Number(monthPart);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [selectedMonth]);

  const currentYear = currentMonthStart.getFullYear();
  const currentMonthNumber = currentMonthStart.getMonth() + 1;

  const isFutureMonthKey = useCallback(
    (monthKey) => {
      if (!monthKey) {
        return false;
      }
      const [yearPart, monthPart] = monthKey.split("-");
      const year = Number(yearPart);
      const month = Number(monthPart);
      if (!Number.isFinite(year) || !Number.isFinite(month)) {
        return false;
      }
      const candidate = new Date(year, month - 1, 1);
      return candidate > currentMonthStart;
    },
    [currentMonthStart]
  );

  const isNextDisabled =
    selectedYearNumber > currentYear ||
    (selectedYearNumber === currentYear &&
      selectedMonthNumber >= currentMonthNumber);

  const toggleQuickMonth = (monthNumber) => {
    setSelectedQuickMonths((previous) => {
      const next = new Set(previous);
      if (next.has(monthNumber)) {
        next.delete(monthNumber);
      } else {
        next.add(monthNumber);
      }
      return next;
    });
  };

  const clearQuickMonths = () => {
    setSelectedQuickMonths(new Set());
  };

  const toggleGroupCollapse = (status) => {
    setCollapsedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  const activeMonthKeys = useMemo(() => {
    const [yearPart] = selectedMonth.split("-");
    const baseYear = Number(yearPart);
    const quickMonths = Array.from(selectedQuickMonths).sort((a, b) => a - b);
    if (quickMonths.length === 0 || Number.isNaN(baseYear)) {
      return isFutureMonthKey(selectedMonth)
        ? [currentMonthKey]
        : [selectedMonth];
    }
    const monthKeys = quickMonths
      .map((monthNumber) => `${baseYear}-${`${monthNumber}`.padStart(2, "0")}`)
      .filter((monthKey) => !isFutureMonthKey(monthKey));
    if (monthKeys.length === 0) {
      return isFutureMonthKey(selectedMonth)
        ? [currentMonthKey]
        : [selectedMonth];
    }
    return monthKeys;
  }, [selectedMonth, selectedQuickMonths, isFutureMonthKey, currentMonthKey]);

  const adjustMonth = (step) => {
    if (!selectedMonth) {
      return;
    }
    const [year, month] = selectedMonth.split("-");
    const target = new Date(Number(year), Number(month) - 1 + step, 1);
    const targetKey = buildMonthKey(target);
    if (isFutureMonthKey(targetKey)) {
      return;
    }
    setSelectedMonth(targetKey);
  };

  const handleMonthPickerOpen = () => {
    if (!monthInputRef.current) {
      return;
    }
    if (typeof monthInputRef.current.showPicker === "function") {
      monthInputRef.current.showPicker();
    } else {
      monthInputRef.current.focus();
      monthInputRef.current.click();
    }
  };

  const handleNativeMonthChange = (event) => {
    if (event.target.value && !isFutureMonthKey(event.target.value)) {
      setSelectedMonth(event.target.value);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        setLoading(true);
        const attendanceRequests = activeMonthKeys.map((monthKey) =>
          apiClient.get("/attendance", {
            params: {
              page: 1,
              pageSize: 400,
              month: monthKey,
              sort: sortOption === "lateness" ? "minutes_late" : "date",
              order: sortDirection,
            },
            signal: controller.signal,
          })
        );

        const [attendanceResponses, summaryResponse] = await Promise.all([
          Promise.all(attendanceRequests),
          apiClient.get("/dashboard/summary", {
            signal: controller.signal,
          }),
        ]);

        if (!isMounted) {
          return;
        }

        const mergedRecords = attendanceResponses.flatMap(
          (response) => response.data?.data ?? []
        );

        setRecords(mergedRecords);
        console.log(mergedRecords);
        console.log(summaryResponse.data);
        setSummary(summaryResponse.data ?? null);
        setError(null);
      } catch (err) {
        if (!isMounted || err.code === "ERR_CANCELED") {
          return;
        }
        setError(
          err.response?.data?.message ??
            "Цаг бүртгэлийн мэдээлэл татах явцад алдаа гарлаа."
        );
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
  }, [activeMonthKeys, sortOption, sortDirection]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortOption, sortDirection, groupBy, activeMonthKeys]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  useEffect(() => {
    if (isFutureMonthKey(selectedMonth)) {
      setSelectedMonth(currentMonthKey);
    }
  }, [selectedMonth, isFutureMonthKey, currentMonthKey]);

  useEffect(() => {
    setSelectedQuickMonths((previous) => {
      if (previous.size === 0) {
        return previous;
      }
      const [yearPart] = selectedMonth.split("-");
      const baseYear = Number(yearPart);
      if (!Number.isFinite(baseYear)) {
        return previous;
      }
      let mutated = false;
      const next = new Set(previous);
      next.forEach((monthNumber) => {
        const monthKey = `${baseYear}-${`${monthNumber}`.padStart(2, "0")}`;
        if (isFutureMonthKey(monthKey)) {
          next.delete(monthNumber);
          mutated = true;
        }
      });
      return mutated ? next : previous;
    });
  }, [selectedMonth, isFutureMonthKey]);

  useEffect(() => {
    if (groupBy !== "status") {
      setCollapsedGroups(new Set());
    }
  }, [groupBy]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm) {
      return records;
    }
    const normalizedQuery = searchTerm.trim().toLowerCase();
    return records.filter((record) => {
      const haystack = [
        record.employee_code,
        record.first_name,
        record.last_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [records, searchTerm]);

  const employeeLateTotals = useMemo(() => {
    const totals = new Map();
    records.forEach((record) => {
      const key = record.employee_id ?? record.employee_code;
      const prev = totals.get(key) ?? 0;
      totals.set(key, prev + (record.minutes_late ?? 0));
    });
    return totals;
  }, [records]);

  const groupedByStatus = useMemo(() => {
    if (groupBy !== "status") {
      return null;
    }
    const groups = new Map();
    filteredRecords.forEach((record) => {
      const status = normalizeStatus(record.status);
      const list = groups.get(status) ?? [];
      list.push(record);
      groups.set(status, list);
    });
    return STATUS_ORDER.map((status) => ({
      status,
      label: STATUS_LABELS[status] ?? status,
      items: groups.get(status) ?? [],
    })).filter((group) => group.items.length > 0);
  }, [filteredRecords, groupBy]);

  const attendanceByDate = useMemo(() => {
    const summaries = new Map();
    const ensureSummary = (key) => {
      if (!summaries.has(key)) {
        summaries.set(key, {
          records: [],
          counts: {
            "On Time": 0,
            Late: 0,
            Absent: 0,
          },
        });
      }
      return summaries.get(key);
    };

    filteredRecords.forEach((record) => {
      if (!record.attendance_date) {
        return;
      }
      const dateKey = record.attendance_date.slice(0, 10);
      const summary = ensureSummary(dateKey);
      summary.records.push(record);
      const normalizedStatus = normalizeStatus(record.status);
      summary.counts[normalizedStatus] =
        (summary.counts[normalizedStatus] ?? 0) + 1;
    });

    return summaries;
  }, [filteredRecords]);

  const attendanceTotals = useMemo(() => {
    const totals = {
      total: 0,
      byStatus: {
        "On Time": 0,
        Late: 0,
        Absent: 0,
      },
      uniqueEmployees: new Set(),
      totalLatenessMinutes: 0,
      totalOvertimeMinutes: 0,
    };

    records.forEach((record) => {
      totals.total += 1;
      const status = normalizeStatus(record.status);
      totals.byStatus[status] += 1;
      const employeeKey =
        record.employee_id ??
        record.employee_code ??
        record.id ??
        (record.first_name || record.last_name
          ? `${record.last_name ?? ""}-${record.first_name ?? ""}`
          : null);
      if (employeeKey !== null) {
        totals.uniqueEmployees.add(employeeKey);
      }
      totals.totalLatenessMinutes += record.minutes_late ?? 0;
      totals.totalOvertimeMinutes += record.overtime_minutes ?? 0;
    });

    return {
      totalEmployees: totals.uniqueEmployees.size,
      lateCount: totals.byStatus.Late,
      absentCount: totals.byStatus.Absent,
      overtimeMinutes: totals.totalOvertimeMinutes,
      onTimeCount: totals.byStatus["On Time"],
    };
  }, [records]);

  const todayKey = useMemo(() => buildDateKey(new Date()), []);

  const monthDate = useMemo(() => {
    const [year, month] = selectedMonth.split("-");
    return new Date(Number(year), Number(month) - 1, 1);
  }, [selectedMonth]);

  const daysInMonth = useMemo(() => {
    const [year, month] = selectedMonth.split("-");
    return new Date(Number(year), Number(month), 0).getDate();
  }, [selectedMonth]);

  const calendarDays = useMemo(() => {
    if (!selectedMonth) {
      return [];
    }
    const [yearPart, monthPart] = selectedMonth.split("-");
    const year = Number(yearPart);
    const monthIndex = Number(monthPart) - 1;
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
      return [];
    }

    const firstOfMonth = new Date(year, monthIndex, 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday as first day
    const baseDate = new Date(year, monthIndex, 1 - startOffset);
    const todayKey = buildDateKey(new Date());

    return Array.from({ length: 42 }, (_, index) => {
      const currentDate = new Date(baseDate);
      currentDate.setDate(baseDate.getDate() + index);
      const key = buildDateKey(currentDate);
      return {
        date: currentDate,
        key,
        isCurrentMonth: currentDate.getMonth() === monthIndex,
        isToday: key === todayKey,
        summary: attendanceByDate.get(key),
      };
    });
  }, [attendanceByDate, selectedMonth]);

  useEffect(() => {
    if (calendarDays.length === 0) {
      if (selectedCalendarDate !== null) {
        setSelectedCalendarDate(null);
      }
      return;
    }
    if (
      selectedCalendarDate &&
      calendarDays.some((day) => day.key === selectedCalendarDate)
    ) {
      return;
    }
    const fallback =
      calendarDays.find((day) => day.isCurrentMonth) ?? calendarDays[0];
    setSelectedCalendarDate(fallback ? fallback.key : null);
  }, [calendarDays, selectedCalendarDate]);

  const dailyChart = useMemo(() => {
    const multipleMonths = activeMonthKeys.length > 1;

    if (multipleMonths) {
      const monthCounts = new Map();
      activeMonthKeys.forEach((monthKey) => {
        monthCounts.set(monthKey, {
          "On Time": 0,
          Late: 0,
          Absent: 0,
        });
      });

      records.forEach((record) => {
        if (!record.attendance_date) {
          return;
        }
        const recordKey = record.attendance_date.slice(0, 7);
        if (!monthCounts.has(recordKey)) {
          return;
        }
        const status = normalizeStatus(record.status);
        const bucket = monthCounts.get(recordKey);
        bucket[status] = (bucket[status] ?? 0) + 1;
      });

      const labels = Array.from(monthCounts.keys());
      const datasets = STATUS_ORDER.map((status) => ({
        label: STATUS_LABELS[status] ?? status,
        data: labels.map((label) => monthCounts.get(label)?.[status] ?? 0),
        backgroundColor: CHART_STATUS_COLORS[status],
        borderRadius: 6,
        barThickness: 22,
      }));

      return { labels, datasets };
    }

    const days = Array.from({ length: daysInMonth }, (_, idx) => idx + 1);
    const datasetsMap = {
      "On Time": Array(daysInMonth).fill(0),
      Late: Array(daysInMonth).fill(0),
      Absent: Array(daysInMonth).fill(0),
    };

    records.forEach((record) => {
      if (!record.attendance_date) {
        return;
      }
      const date = new Date(record.attendance_date);
      const recordKey = buildMonthKey(date);
      if (recordKey !== selectedMonth) {
        return;
      }
      const dayIndex = date.getDate() - 1;
      const status = normalizeStatus(record.status);
      datasetsMap[status][dayIndex] += 1;
    });

    const datasets = STATUS_ORDER.filter((status) =>
      datasetsMap[status].some((value) => value > 0)
    ).map((status) => ({
      label: STATUS_LABELS[status] ?? status,
      data: datasetsMap[status],
      backgroundColor: CHART_STATUS_COLORS[status],
      borderRadius: 6,
      barThickness: 16,
    }));

    return {
      labels: days.map((day) => day.toString().padStart(2, "0")),
      datasets,
    };
  }, [records, selectedMonth, daysInMonth, activeMonthKeys]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            boxWidth: 12,
            boxHeight: 12,
            color: "#1e293b",
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const count = context.raw ?? 0;
              return `${context.dataset.label}: ${formatNumber(count)}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: "#475569",
            font: {
              size: 11,
            },
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: "#e2e8f0",
          },
          ticks: {
            stepSize: 1,
            color: "#475569",
            font: {
              size: 11,
            },
          },
        },
      },
    }),
    []
  );

  const selectedDaySummary = selectedCalendarDate
    ? attendanceByDate.get(selectedCalendarDate) ?? null
    : null;
  const selectedDayRecords = selectedDaySummary?.records ?? [];
  const selectedDayCounts = selectedDaySummary?.counts ?? EMPTY_STATUS_COUNTS;
  const selectedDayLabel = useMemo(() => {
    if (!selectedCalendarDate) {
      return null;
    }
    return new Intl.DateTimeFormat("mn-MN", {
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(new Date(selectedCalendarDate));
  }, [selectedCalendarDate]);
  const selectedDayTotal = selectedDayRecords.length;

  const sortedFilteredRecords = useMemo(() => {
    if (groupBy === "status") {
      return filteredRecords;
    }
    const copy = [...filteredRecords];
    const comparator = (a, b) => {
      if (sortOption === "lateness") {
        const diff = (a.minutes_late ?? 0) - (b.minutes_late ?? 0);
        return sortDirection === "asc" ? diff : -diff;
      }
      const timestampA = a.attendance_date
        ? new Date(a.attendance_date).getTime()
        : 0;
      const timestampB = b.attendance_date
        ? new Date(b.attendance_date).getTime()
        : 0;
      return sortDirection === "asc"
        ? timestampA - timestampB
        : timestampB - timestampA;
    };
    copy.sort(comparator);
    return copy;
  }, [filteredRecords, sortOption, sortDirection, groupBy]);

  const totalPages = useMemo(() => {
    if (groupBy === "status") {
      return 1;
    }
    const total = sortedFilteredRecords.length;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [sortedFilteredRecords, pageSize, groupBy]);

  useEffect(() => {
    if (groupBy === "status") {
      if (currentPage !== 1) {
        setCurrentPage(1);
      }
      return;
    }
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [groupBy, totalPages, currentPage]);

  const paginatedRecords = useMemo(() => {
    if (groupBy === "status") {
      return sortedFilteredRecords;
    }
    const start = (currentPage - 1) * pageSize;
    return sortedFilteredRecords.slice(start, start + pageSize);
  }, [sortedFilteredRecords, currentPage, pageSize, groupBy]);

  const totalRecords = sortedFilteredRecords.length;

  const pageRange = useMemo(() => {
    if (groupBy === "status" || totalRecords === 0) {
      return null;
    }
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(totalRecords, currentPage * pageSize);
    return { start, end };
  }, [groupBy, totalRecords, currentPage, pageSize]);

  const highlightedDateLabel = useMemo(() => {
    if (records.length === 0) {
      return new Intl.DateTimeFormat("mn-MN", {
        month: "long",
      }).format(monthDate);
    }
    const latestRecord = [...records].sort((a, b) => {
      const timeA = a.attendance_date
        ? new Date(a.attendance_date).getTime()
        : 0;
      const timeB = b.attendance_date
        ? new Date(b.attendance_date).getTime()
        : 0;
      return timeB - timeA;
    })[0];
    if (!latestRecord?.attendance_date) {
      return new Intl.DateTimeFormat("mn-MN", {
        month: "long",
      }).format(monthDate);
    }
    return new Intl.DateTimeFormat("mn-MN", {
      month: "long",
      day: "numeric",
    }).format(new Date(latestRecord.attendance_date));
  }, [records, monthDate]);

  const distributionSource = useMemo(() => {
    const todaySummary = attendanceByDate.get(todayKey) ?? null;
    const label = todaySummary ? "Өнөөдөр" : "Өнөөдрийн мэдээлэл алга";
    const counts = todaySummary?.counts ?? EMPTY_STATUS_COUNTS;
    return { label, counts };
  }, [attendanceByDate, todayKey]);

  const safeDaily = useMemo(() => {
    const daily = summary?.attendance?.daily;
    if (Array.isArray(daily) && daily.length > 0 && daily[0]) {
      return daily[0];
    }
    return {
      on_time: 0,
      late: 0,
      absent: 0,
      overtime_minutes: 0,
    };
  }, [summary]);

  const totalEmployees = Number.isFinite(summary?.employees?.total)
    ? summary?.employees?.total
    : attendanceTotals.totalEmployees || 0;

  const distribution = [
    {
      status: "On Time",
      label: "Ирсэн",
      count: safeDaily.on_time,
      percent: percentCalculator(safeDaily.on_time, totalEmployees),
      color: STATUS_COLORS["On Time"],
    },
    {
      status: "Late",
      label: "Хоцорсон",
      count: safeDaily.late,
      percent: percentCalculator(safeDaily.late, totalEmployees),
      color: STATUS_COLORS["Late"],
    },
    {
      status: "Absent",
      label: "Тасалсан",
      count: safeDaily.absent,
      percent: percentCalculator(safeDaily.absent, totalEmployees),
      color: STATUS_COLORS["Absent"],
    },
  ];

  const distributionLabel = distributionSource.label;

  const monthLabel = useMemo(() => {
    if (activeMonthKeys.length > 1) {
      return "Сонгосон сарууд";
    }
    return new Intl.DateTimeFormat("mn-MN", {
      month: "long",
    }).format(monthDate);
  }, [monthDate, activeMonthKeys]);
  const yearLabel = activeMonthKeys.length > 1 ? "" : monthDate.getFullYear();
  const hasSidebar = activeView !== "calendar";

  return (
    <section className="px-6 pb-12">
      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-[40px]  p-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex rounded-full bg-white p-1 shadow-sm">
            {[
              { id: "table", label: "Хүснэгт" },
              { id: "calendar", label: "Календар" },
            ].map((view) => {
              const isActive = activeView === view.id;
              return (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => setActiveView(view.id)}
                  className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-slate-900 text-white shadow"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {view.label}
                </button>
              );
            })}
          </div>
          <h1 className="text-2xl font-semibold text-black">Цаг бүртгэл</h1>
        </header>

        <div
          className={`grid gap-6 ${
            hasSidebar ? "lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]" : ""
          }`}
        >
          <article className="rounded-[30px] bg-white p-6 shadow-lg">
            <div className="mb-5 flex flex-wrap items-center gap-4">
              {activeView !== "calendar" ? (
                <Searchbar
                  placeholder="ажилтан"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full max-w-xs"
                />
              ) : (
                <div className="h-10" aria-hidden="true" />
              )}

              {activeView !== "calendar" ? (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Эрэмлэх</span>
                    <div className="flex gap-2">
                      {SORT_OPTIONS.map((option) => (
                        <WhiteButton
                          key={option.value}
                          label={option.label}
                          onClick={() => setSortOption(option.value)}
                          isSelected={sortOption === option.value}
                        />
                      ))}
                    </div>
                  </div>
                  <WhiteButton
                    label={sortDirection === "asc" ? "↑" : "↓"}
                    onClick={() => {
                      setSortDirection((prev) =>
                        prev === "asc" ? "desc" : "asc"
                      );
                    }}
                    ariaLabel="Toggle sort direction"
                    className="min-w-11"
                  />

                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Ангилах</span>
                    <div className="flex gap-2">
                      {GROUP_OPTIONS.map((option) => (
                        <WhiteButton
                          key={option.value}
                          label={option.label}
                          onClick={() => setGroupBy(option.value)}
                          isSelected={groupBy === option.value}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className=" flex items-center gap-2 text-sm">
                <span className="text-slate-500">Сар</span>
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => adjustMonth(-1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-base font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    aria-label="Өмнөх сар"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={handleMonthPickerOpen}
                    className="flex flex-col items-start justify-center rounded-full px-2 py-1 text-left leading-tight text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    aria-label="Сарыг сонгох"
                    aria-controls={monthInputId}
                  >
                    <span className="text-sm font-semibold capitalize text-slate-800">
                      {monthLabel}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">
                      {yearLabel}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustMonth(1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-base font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 disabled:opacity-60"
                    aria-label="Дараагийн сар"
                    disabled={isNextDisabled}
                  >
                    ›
                  </button>
                  <input
                    id={monthInputId}
                    ref={monthInputRef}
                    type="month"
                    value={selectedMonth}
                    onChange={handleNativeMonthChange}
                    max={currentMonthKey}
                    className="sr-only"
                  />
                </div>
              </div>

              {activeView !== "calendar" ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-slate-500">Сар сонгох</span>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_MONTH_OPTIONS.map((monthNumber) => {
                      const isSelected = selectedQuickMonths.has(monthNumber);
                      const baseYear = selectedYearNumber || currentYear;
                      const monthKey = `${baseYear}-${`${monthNumber}`.padStart(
                        2,
                        "0"
                      )}`;
                      const isFutureOption = isFutureMonthKey(monthKey);
                      return (
                        <WhiteButton
                          key={`quick-month-${monthNumber}`}
                          label={`${monthNumber} сар`}
                          onClick={() => toggleQuickMonth(monthNumber)}
                          isSelected={isSelected}
                          ariaLabel={`${monthNumber} сар сонгох`}
                          disabled={isFutureOption}
                        />
                      );
                    })}
                    <WhiteButton
                      label="X"
                      onClick={clearQuickMonths}
                      disabled={selectedQuickMonths.size === 0}
                      ariaLabel="Сонгосон сарнуудыг арилгах"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {activeView === "calendar" ? (
              <div className="grid gap-6">
                <div className="rounded-[30px] border border-slate-200 bg-white p-4 sm:p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">
                      Календар
                    </h2>
                    <span className="text-sm font-medium text-slate-500">
                      {monthLabel} {yearLabel}
                    </span>
                  </div>
                  <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {WEEKDAY_LABELS.map((label) => (
                      <span key={`weekday-${label}`} className="py-2">
                        {label}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 grid grid-cols-7 gap-2">
                    {calendarDays.map((day) => {
                      const counts = day.summary?.counts ?? EMPTY_STATUS_COUNTS;
                      const isSelected = selectedCalendarDate === day.key;
                      const buttonClasses = `flex h-32 flex-col rounded-2xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-slate-300 ${
                        isSelected
                          ? "border-slate-900 bg-slate-900 text-white shadow-[0_12px_30px_rgba(15,23,42,0.2)]"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                      } ${day.isCurrentMonth ? "" : "opacity-60"}`;
                      const accessibleLabel = new Intl.DateTimeFormat("mn-MN", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        weekday: "long",
                      }).format(day.date);
                      return (
                        <button
                          type="button"
                          key={day.key}
                          onClick={() => setSelectedCalendarDate(day.key)}
                          className={buttonClasses}
                          aria-pressed={isSelected}
                          aria-label={`${accessibleLabel} - өдөр сонгох`}
                        >
                          <div className="flex items-start justify-between">
                            <span
                              className={`min-h-4 text-[11px] font-semibold ${
                                day.isToday
                                  ? isSelected
                                    ? "text-emerald-200"
                                    : "text-emerald-600"
                                  : isSelected
                                  ? "text-white/60"
                                  : "text-slate-400"
                              }`}
                            >
                              {day.isToday ? "Өнөөдөр" : ""}
                            </span>
                            <span className="text-lg font-semibold leading-none">
                              {day.date.getDate()}
                            </span>
                          </div>
                          <div
                            className={`mt-3 flex h-2 overflow-hidden rounded-full ${
                              isSelected ? "bg-white/20" : "bg-slate-100"
                            }`}
                            aria-hidden="true"
                          >
                            {STATUS_ORDER.map((status) => {
                              const count = counts[status] ?? 0;
                              if (!count) {
                                return null;
                              }
                              return (
                                <span
                                  key={`day-${day.key}-${status}`}
                                  className="h-full"
                                  style={{
                                    flex: count,
                                    backgroundColor: STATUS_COLORS[status],
                                  }}
                                />
                              );
                            })}
                          </div>
                          <div className="mt-3 flex flex-col gap-1">
                            {STATUS_ORDER.map((status) => (
                              <span
                                key={`day-count-${day.key}-${status}`}
                                className="flex items-center justify-between"
                              >
                                <span
                                  className={`text-[11px] font-medium ${
                                    isSelected
                                      ? "text-white/70"
                                      : "text-slate-500"
                                  }`}
                                >
                                  {STATUS_LABELS[status] ?? status}
                                </span>
                                <span
                                  className={`text-xs font-semibold ${
                                    isSelected ? "text-white" : "text-slate-700"
                                  }`}
                                >
                                  {formatNumber(counts[status] ?? 0)}
                                </span>
                              </span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[30px] border border-slate-200 bg-white p-4 sm:p-6">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">
                        {selectedDayLabel ?? "Өдрийг сонгох"}
                      </h2>
                      <p className="text-sm text-slate-500">
                        {selectedDayLabel
                          ? `${formatNumber(selectedDayTotal)} бүртгэл`
                          : "Календараас нэг өдрийг дарж дэлгэрэнгүйг үзнэ үү."}
                      </p>
                    </div>
                    {selectedDayLabel ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {STATUS_ORDER.map((status) => (
                          <span
                            key={`selected-day-chip-${status}`}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: STATUS_COLORS[status] }}
                            />
                            <span>{STATUS_LABELS[status] ?? status}</span>
                            <span className="text-slate-400">
                              {formatNumber(selectedDayCounts[status] ?? 0)}
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {selectedDayLabel ? (
                    selectedDayRecords.length > 0 ? (
                      <div className="overflow-x-auto rounded-[28px] border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-6 py-3">ID</th>
                              <th className="px-6 py-3">Овог</th>
                              <th className="px-6 py-3">Нэр</th>
                              <th className="px-6 py-3">Хоцорсон цаг</th>
                              <th className="px-6 py-3">Илүү цаг</th>
                              <th className="px-6 py-3">Нийт хоцролт</th>
                              <th className="px-6 py-3">Статус</th>
                              <th className="px-6 py-3">Огноо</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {selectedDayRecords.map((record) => {
                              const aggregateKey =
                                record.employee_id ?? record.employee_code;
                              const totalLateMinutes =
                                employeeLateTotals.get(aggregateKey) ?? 0;
                              const statusLabel =
                                STATUS_LABELS[record.status] ?? record.status;
                              const statusColor =
                                STATUS_COLORS[record.status] ?? "#0f172a";
                              return (
                                <tr
                                  key={
                                    record.id ??
                                    `${record.employee_id}-${record.attendance_date}`
                                  }
                                >
                                  <td className="px-6 py-4 text-slate-700">
                                    {record.employee_code ?? "--"}
                                  </td>
                                  <td className="px-6 py-4 text-slate-700">
                                    {record.last_name ?? "--"}
                                  </td>
                                  <td className="px-6 py-4 text-slate-700">
                                    {record.first_name ?? "--"}
                                  </td>
                                  <td className="px-6 py-4 font-medium text-red-500">
                                    {formatMinutesLate(record.minutes_late)}
                                  </td>
                                  <td className="px-6 py-4 text-purple-600">
                                    {formatOvertime(record.overtime_minutes)}
                                  </td>
                                  <td className="px-6 py-4 text-slate-700">
                                    {formatMinutesLate(totalLateMinutes)}
                                  </td>
                                  <td className="px-6 py-4">
                                    <span
                                      className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold"
                                      style={{ color: statusColor }}
                                    >
                                      <span
                                        className="h-2 w-2 rounded-full"
                                        style={{ backgroundColor: statusColor }}
                                      />
                                      {statusLabel}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-slate-500">
                                    {record.attendance_date
                                      ? new Intl.DateTimeFormat("mn-MN", {
                                          month: "short",
                                          day: "numeric",
                                        }).format(
                                          new Date(record.attendance_date)
                                        )
                                      : "--"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                        Сонгосон өдөрт бүртгэл олдсонгүй.
                      </div>
                    )
                  ) : (
                    <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                      Календараас нэг өдрийг дарж дэлгэрэнгүйг үзнэ үү.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-[30px] border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-6 py-3">ID</th>
                        <th className="px-6 py-3">Овог</th>
                        <th className="px-6 py-3">Нэр</th>
                        <th className="px-6 py-3">Хоцорсон цаг</th>
                        <th className="px-6 py-3">Илүү цаг</th>
                        <th className="px-6 py-3">Нийт хоцролт</th>
                        <th className="px-6 py-3">Статус</th>
                        <th className="px-6 py-3">Огноо</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {loading ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-6 py-10 text-center text-sm text-slate-500"
                          >
                            Өгөгдөл татаж байна...
                          </td>
                        </tr>
                      ) : groupBy === "status" && groupedByStatus ? (
                        groupedByStatus.map((group) => {
                          const isCollapsed = collapsedGroups.has(group.status);
                          return (
                            <Fragment key={`group-${group.status}`}>
                              <tr className="bg-slate-50">
                                <td
                                  colSpan={8}
                                  className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleGroupCollapse(group.status)
                                    }
                                    aria-expanded={!isCollapsed}
                                    className="flex w-full items-center justify-between gap-4 rounded-lg px-2 py-1 text-left text-slate-600 transition hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                  >
                                    <span className="flex items-center gap-3">
                                      <span className="text-base">
                                        {isCollapsed ? "▸" : "▾"}
                                      </span>
                                      <span>{group.label}</span>
                                    </span>
                                    <span className="text-xs font-medium text-slate-400">
                                      {formatNumber(group.items.length)}
                                    </span>
                                  </button>
                                </td>
                              </tr>
                              {isCollapsed
                                ? null
                                : group.items.map((record) => {
                                    const aggregateKey =
                                      record.employee_id ??
                                      record.employee_code;
                                    const totalLateMinutes =
                                      employeeLateTotals.get(aggregateKey) ?? 0;
                                    const statusLabel =
                                      STATUS_LABELS[record.status] ??
                                      record.status;
                                    const statusColor =
                                      STATUS_COLORS[record.status] ?? "#0f172a";
                                    return (
                                      <tr
                                        key={
                                          record.id ??
                                          `${record.employee_id}-${record.attendance_date}`
                                        }
                                      >
                                        <td className="px-6 py-4 text-slate-700">
                                          {record.employee_code ?? "--"}
                                        </td>
                                        <td className="px-6 py-4 text-slate-700">
                                          {record.last_name ?? "--"}
                                        </td>
                                        <td className="px-6 py-4 text-slate-700">
                                          {record.first_name ?? "--"}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-red-500">
                                          {formatMinutesLate(
                                            record.minutes_late
                                          )}
                                        </td>
                                        <td className="px-6 py-4 text-purple-600">
                                          {formatOvertime(
                                            record.overtime_minutes
                                          )}
                                        </td>
                                        <td className="px-6 py-4 text-slate-700">
                                          {formatMinutesLate(totalLateMinutes)}
                                        </td>
                                        <td className="px-6 py-4">
                                          <span
                                            className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold"
                                            style={{ color: statusColor }}
                                          >
                                            <span
                                              className="h-2 w-2 rounded-full"
                                              style={{
                                                backgroundColor: statusColor,
                                              }}
                                            />
                                            {statusLabel}
                                          </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">
                                          {record.attendance_date
                                            ? new Intl.DateTimeFormat("mn-MN", {
                                                month: "short",
                                                day: "numeric",
                                              }).format(
                                                new Date(record.attendance_date)
                                              )
                                            : "--"}
                                        </td>
                                      </tr>
                                    );
                                  })}
                            </Fragment>
                          );
                        })
                      ) : totalRecords === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-6 py-10 text-center text-sm text-slate-500"
                          >
                            Мэдээлэл олдсонгүй.
                          </td>
                        </tr>
                      ) : (
                        paginatedRecords.map((record) => {
                          const aggregateKey =
                            record.employee_id ?? record.employee_code;
                          const totalLateMinutes =
                            employeeLateTotals.get(aggregateKey) ?? 0;
                          const statusLabel =
                            STATUS_LABELS[record.status] ?? record.status;
                          const statusColor =
                            STATUS_COLORS[record.status] ?? "#0f172a";
                          return (
                            <tr
                              key={
                                record.id ??
                                `${record.employee_id}-${record.attendance_date}`
                              }
                            >
                              <td className="px-6 py-4 text-slate-700">
                                {record.employee_code ?? "--"}
                              </td>
                              <td className="px-6 py-4 text-slate-700">
                                {record.last_name ?? "--"}
                              </td>
                              <td className="px-6 py-4 text-slate-700">
                                {record.first_name ?? "--"}
                              </td>
                              <td className="px-6 py-4 font-medium text-red-500">
                                {formatMinutesLate(record.minutes_late)}
                              </td>
                              <td className="px-6 py-4 text-purple-600">
                                {formatOvertime(record.overtime_minutes)}
                              </td>
                              <td className="px-6 py-4 text-slate-700">
                                {formatMinutesLate(totalLateMinutes)}
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold"
                                  style={{ color: statusColor }}
                                >
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: statusColor }}
                                  />
                                  {statusLabel}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-slate-500">
                                {record.attendance_date
                                  ? new Intl.DateTimeFormat("mn-MN", {
                                      month: "short",
                                      day: "numeric",
                                    }).format(new Date(record.attendance_date))
                                  : "--"}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {!loading && groupBy !== "status" && totalRecords > 0 ? (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                    <span className="text-sm text-slate-500">
                      {pageRange
                        ? `${pageRange.start} - ${
                            pageRange.end
                          } / ${formatNumber(totalRecords)}`
                        : `${formatNumber(totalRecords)} бичлэг`}
                    </span>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-slate-400">
                          Page size
                        </span>
                        <div className="flex gap-2">
                          {PAGE_SIZE_OPTIONS.map((option) => (
                            <WhiteButton
                              key={`page-size-${option}`}
                              label={`${option}`}
                              onClick={() => setPageSize(option)}
                              isSelected={pageSize === option}
                              ariaLabel={`Хуудасны хэмжээ ${option}`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <WhiteButton
                          label="‹"
                          onClick={() =>
                            setCurrentPage((prev) => Math.max(1, prev - 1))
                          }
                          disabled={currentPage === 1}
                          ariaLabel="Өмнөх хуудас"
                        />
                        <span className="text-sm font-semibold text-slate-700">
                          {currentPage} / {totalPages}
                        </span>
                        <WhiteButton
                          label="›"
                          onClick={() =>
                            setCurrentPage((prev) =>
                              Math.min(totalPages, prev + 1)
                            )
                          }
                          disabled={currentPage === totalPages}
                          ariaLabel="Дараагийн хуудас"
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </article>

          {hasSidebar ? (
            <aside className="flex flex-col gap-6">
              <article className="rounded-[30px] bg-white p-6 shadow-lg">
                <header className="mb-4 text-xl font-semibold text-slate-900">
                  Цаг бүртгэл
                </header>
                <ul className="flex flex-col gap-3 text-sm text-slate-700">
                  <li className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-2">
                    <span className="flex items-center gap-2">
                      <span>👥</span>Нийт ажилтан
                    </span>
                    <span className="font-semibold text-slate-900">
                      {loading
                        ? "--"
                        : formatNumber(
                            summary?.employees?.total ??
                              attendanceTotals.totalEmployees
                          )}
                    </span>
                  </li>
                  <li className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-2">
                    <span className="flex items-center gap-2">
                      <span>✅</span>Цагтаа ирсэн
                    </span>
                    <span className="font-semibold text-slate-900">
                      {loading ? "--" : formatNumber(safeDaily.on_time)}
                    </span>
                  </li>
                  <li className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-2">
                    <span className="flex items-center gap-2">
                      <span>⏰</span>Хоцорсон
                    </span>
                    <span className="font-semibold text-slate-900">
                      {loading ? "--" : formatNumber(safeDaily.late)}
                    </span>
                  </li>
                  <li className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-2">
                    <span className="flex items-center gap-2">
                      <span>❌</span>Тасалсан
                    </span>
                    <span className="font-semibold text-slate-900">
                      {loading ? "--" : formatNumber(safeDaily.absent)}
                    </span>
                  </li>
                  <li className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-2">
                    <span className="flex items-center gap-2">
                      <span>⏳</span>Илүү цаг
                    </span>
                    <span className="font-semibold text-slate-900">
                      {loading
                        ? "--"
                        : formatOvertime(safeDaily.overtime_minutes)}
                    </span>
                  </li>
                </ul>
              </article>

              <article className="rounded-[30px] bg-white p-6 shadow-lg">
                <header className="mb-4 text-xl font-semibold text-slate-900">
                  {distributionLabel}
                </header>
                <div className="mb-4 h-16 overflow-hidden rounded-[20px] border border-slate-200">
                  <div className="flex h-full w-full">
                    {distribution.map((item) => (
                      <div
                        key={item.status}
                        className="flex items-center justify-center text-xs  font-semibold text-white"
                        style={{
                          width: `${item.percent}`,
                          backgroundColor: item.color,
                        }}
                      >
                        {" "}
                      </div>
                    ))}
                  </div>
                </div>
                <ul className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                  {distribution.map((item) => (
                    <li
                      key={`legend-${item.status}`}
                      className="flex items-center gap-2"
                    >
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-semibold text-slate-700">
                        {item.label}
                      </span>
                      <span className="text-slate-500">
                        {loading
                          ? "--"
                          : `${item.percent} (${formatNumber(item.count)})`}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-[30px] bg-white p-6 shadow-lg">
                <header className="mb-4 text-xl font-semibold text-slate-900">
                  {monthLabel}
                </header>
                <div className="h-64">
                  {dailyChart.datasets.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                      Мэдээлэл олдсонгүй.
                    </div>
                  ) : (
                    <Bar data={dailyChart} options={chartOptions} />
                  )}
                </div>
              </article>
            </aside>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default TimeTracking;
