import {
  addDays,
  endOfWeek,
  format as formatDate,
  isAfter,
  isBefore,
  isSameDay,
  isSameWeek,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import BlackButton from "../components/BlackButton.jsx";
import Searchbar from "../components/Searchbar.jsx";
import apiClient from "../utils/apiClient";

const TASK_STATUS_OPTIONS = [
  { value: "Working On It", label: "Working On It" },
  { value: "Pending", label: "Pending" },
  { value: "On Hold", label: "On Hold" },
  { value: "Stuck", label: "Stuck" },
  { value: "Completed", label: "Completed" },
];

const STATUS_KEYWORDS = {
  working: ["working on it", "working", "in progress"],
  pending: ["pending", "waiting"],
  onHold: ["on hold", "paused"],
  stuck: ["stuck", "blocked"],
  completed: ["completed", "done"],
};

const STATUS_STYLES = {
  working: {
    label: "Working On It",
    badgeClass: "bg-sky-100 text-sky-700",
    dotClass: "bg-sky-500",
  },
  pending: {
    label: "Pending",
    badgeClass: "bg-amber-100 text-amber-700",
    dotClass: "bg-amber-500",
  },
  onHold: {
    label: "On Hold",
    badgeClass: "bg-slate-200 text-slate-700",
    dotClass: "bg-slate-400",
  },
  stuck: {
    label: "Stuck",
    badgeClass: "bg-rose-100 text-rose-700",
    dotClass: "bg-rose-500",
  },
  completed: {
    label: "Completed",
    badgeClass: "bg-emerald-100 text-emerald-700",
    dotClass: "bg-emerald-500",
  },
  unknown: {
    label: "Unassigned",
    badgeClass: "bg-slate-100 text-slate-500",
    dotClass: "bg-slate-400",
  },
};

const STATUS_ORDER = [
  "working",
  "pending",
  "onHold",
  "stuck",
  "completed",
  "unknown",
];

const VIEW_FILTER_OPTIONS = [
  { value: "date", label: "Он сараар" },
  { value: "board", label: "Самбараар" },
  { value: "status", label: "Статусаар" },
  { value: "all", label: "Бүгд" },
];

const monthLabelFormatter = new Intl.DateTimeFormat("mn-MN", {
  year: "numeric",
  month: "long",
});

const dateLabelFormatter = new Intl.DateTimeFormat("mn-MN", {
  month: "short",
  day: "numeric",
});

const weekdayLabelFormatter = new Intl.DateTimeFormat("mn-MN", {
  weekday: "short",
});

const CALENDAR_WEEKDAY_LABELS = Array.from({ length: 7 }, (_, index) => {
  const base = startOfWeek(new Date(), { weekStartsOn: 1 });
  return weekdayLabelFormatter.format(addDays(base, index));
});

const formatTaskCount = (count) => `${count} ажил`;

const formatDateKey = (date) => formatDate(date, "yyyy-MM-dd");

const parseDate = (value) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildCalendarTaskTooltip = (task) => {
  if (!task) {
    return "";
  }
  const dueDateLabel = task.dueDateStart
    ? dateLabelFormatter.format(task.dueDateStart)
    : "Товлогдоогүй";
  const assigneeLabel = task.assignees?.length
    ? task.assignees.map((assignee) => assignee.name).join(", ")
    : "Томилогдоогүй";
  return [
    `Ажил: ${task.name}`,
    `Самбар: ${task.board}`,
    `Групп: ${task.group}`,
    `Статус: ${task.statusLabel}`,
    `Огноо: ${dueDateLabel}`,
    `Хариуцагч: ${assigneeLabel}`,
  ].join("\n");
};

const resolveStatusKey = (status) => {
  if (!status) {
    return "unknown";
  }
  const normalized = status.trim().toLowerCase();
  for (const [key, keywords] of Object.entries(STATUS_KEYWORDS)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return key;
    }
  }
  return "unknown";
};

const sortByDueDate = (left, right) => {
  if (left.dueDateStart && right.dueDateStart) {
    if (left.dueDateStart.getTime() !== right.dueDateStart.getTime()) {
      return left.dueDateStart.getTime() - right.dueDateStart.getTime();
    }
  }
  if (left.dueDateStart) {
    return -1;
  }
  if (right.dueDateStart) {
    return 1;
  }
  return left.name.localeCompare(right.name);
};

const buildSections = (tasks, viewFilter) => {
  const today = startOfDay(new Date());
  const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });
  const endOfCurrentWeek = endOfWeek(today, { weekStartsOn: 1 });
  const startOfNextWeek = addDays(startOfCurrentWeek, 7);

  if (viewFilter === "date") {
    const dateSections = [
      {
        id: "past-date",
        title: "Дууссан",
        matcher: (task) =>
          task.dueDateStart ? isBefore(task.dueDateStart, today) : false,
      },
      {
        id: "today",
        title: "Өнөөдөр",
        matcher: (task) =>
          task.dueDateStart ? isSameDay(task.dueDateStart, today) : false,
      },
      {
        id: "this-week",
        title: "Энэ долоо хоног",
        matcher: (task) =>
          task.dueDateStart
            ? isSameWeek(task.dueDateStart, today, { weekStartsOn: 1 }) &&
              !isSameDay(task.dueDateStart, today) &&
              isAfter(task.dueDateStart, today)
            : false,
      },
      {
        id: "next-week",
        title: "Дараа долоо хоног",
        matcher: (task) =>
          task.dueDateStart
            ? task.dueDateStart.getTime() >= startOfNextWeek.getTime()
            : false,
      },
      {
        id: "without-date",
        title: "Он сар байхгүй",
        matcher: (task) => !task.dueDateStart,
      },
    ];

    const sections = dateSections
      .map((section) => {
        const sectionTasks = tasks
          .filter(section.matcher)
          .slice()
          .sort(sortByDueDate);
        return {
          id: section.id,
          title: section.title,
          countLabel: formatTaskCount(sectionTasks.length),
          tasks: sectionTasks,
        };
      })
      .filter((section) => section.tasks.length > 0);

    if (sections.length > 0) {
      return sections;
    }
  }

  if (viewFilter === "board") {
    const grouped = new Map();
    tasks.forEach((task) => {
      const key = task.board || "Untitled Board";
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(task);
    });

    const sections = Array.from(grouped.entries())
      .map(([boardName, boardTasks]) => {
        const sorted = boardTasks.slice().sort(sortByDueDate);
        return {
          id: boardName,
          title: boardName,
          countLabel: formatTaskCount(sorted.length),
          tasks: sorted,
        };
      })
      .sort((left, right) => left.title.localeCompare(right.title));

    if (sections.length > 0) {
      return sections;
    }
  }

  if (viewFilter === "status") {
    const grouped = new Map();
    tasks.forEach((task) => {
      const key = task.statusKey || resolveStatusKey(task.statusLabel);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(task);
    });

    const sections = STATUS_ORDER.map((key) => {
      const sectionTasks = (grouped.get(key) ?? []).slice().sort(sortByDueDate);
      const meta = STATUS_STYLES[key] ?? STATUS_STYLES.unknown;
      return {
        id: key,
        title: meta.label,
        countLabel: formatTaskCount(sectionTasks.length),
        tasks: sectionTasks,
      };
    }).filter((section) => section.tasks.length > 0);

    if (sections.length > 0) {
      return sections;
    }
  }

  const sortedTasks = tasks.slice().sort(sortByDueDate);
  const sectionTitle =
    VIEW_FILTER_OPTIONS.find((option) => option.value === viewFilter)?.label ||
    "All Tasks";

  return [
    {
      id: "all",
      title: sectionTitle,
      countLabel: formatTaskCount(sortedTasks.length),
      tasks: sortedTasks,
    },
  ];
};

const buildCalendarMatrix = (monthDate, tasks) => {
  const start = startOfWeek(
    new Date(monthDate.getFullYear(), monthDate.getMonth(), 1),
    { weekStartsOn: 1 }
  );
  const lastDay = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0
  );
  const end = startOfWeek(lastDay, { weekStartsOn: 1 });
  const finalDay = addDays(end, 6);

  const tasksByDate = tasks.reduce((accumulator, task) => {
    if (!task.dueDateKey) {
      return accumulator;
    }
    if (!accumulator[task.dueDateKey]) {
      accumulator[task.dueDateKey] = [];
    }
    accumulator[task.dueDateKey].push(task);
    return accumulator;
  }, {});

  const days = [];
  let cursor = new Date(start);

  while (cursor <= finalDay) {
    const currentDate = new Date(cursor);
    const key = formatDateKey(currentDate);
    const dayTasks = tasksByDate[key] ?? [];
    days.push({
      key,
      date: currentDate,
      isCurrentMonth:
        currentDate.getMonth() === monthDate.getMonth() &&
        currentDate.getFullYear() === monthDate.getFullYear(),
      tasks: dayTasks,
    });
    cursor = addDays(cursor, 1);
  }

  return days;
};

const buildInitials = (name) => {
  if (!name) {
    return "?";
  }
  const parts = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase());
  return parts.join("") || "?";
};

const AVATAR_COLORS = [
  "bg-sky-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-indigo-500",
  "bg-fuchsia-500",
  "bg-teal-500",
];

const getAvatarColor = (index) =>
  AVATAR_COLORS[index % AVATAR_COLORS.length] ?? "bg-slate-400";

const formatEmployeeName = (employee) => {
  const first = employee?.first_name?.trim();
  const last = employee?.last_name?.trim();
  const full = [first, last].filter(Boolean).join(" ");
  if (full) {
    return full;
  }
  if (employee?.employee_code) {
    return employee.employee_code;
  }
  if (employee?.email) {
    return employee.email;
  }
  return "Employee";
};

const createInitialFormState = (defaultBoardId, task) => {
  if (task) {
    return {
      title: task.title || "",
      boardId: task.board_id ? String(task.board_id) : defaultBoardId ?? "",
      statusGroupId: task.status_group_id ? String(task.status_group_id) : "",
      status: task.status || TASK_STATUS_OPTIONS[0]?.value || "Working On It",
      taskGroup: task.task_group || "",
      plannedStartDate: task.planned_start_date || "",
      plannedEndDate: task.planned_end_date || "",
      description: task.description || "",
      assigneeIds: (task.assignees || [])
        .filter((assigneeId) => assigneeId !== null && assigneeId !== undefined)
        .map((assigneeId) => String(assigneeId)),
    };
  }

  return {
    title: "",
    boardId: defaultBoardId ?? "",
    statusGroupId: "",
    status: TASK_STATUS_OPTIONS[0]?.value ?? "Working On It",
    taskGroup: "",
    plannedStartDate: "",
    plannedEndDate: "",
    description: "",
    assigneeIds: [],
  };
};

function TaskModal({
  isOpen,
  mode = "create",
  task,
  onClose,
  boards,
  defaultBoardId,
  onCreate,
  onUpdate,
  fetchStatusGroups,
  statusGroupsCache,
  fetchBoardMembers,
  boardMembersCache,
}) {
  const isEditMode = mode === "edit";
  const [formState, setFormState] = useState(() =>
    createInitialFormState(defaultBoardId, task)
  );
  const [statusGroups, setStatusGroups] = useState([]);
  const [boardMembers, setBoardMembers] = useState([]);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormState(createInitialFormState(defaultBoardId, task));
      setStatusGroups([]);
      setBoardMembers([]);
      setFormError("");
    }
  }, [defaultBoardId, isEditMode, isOpen, task]);

  useEffect(() => {
    if (!isOpen || !formState.boardId) {
      setStatusGroups([]);
      return undefined;
    }

    const boardKey = formState.boardId;
    const cached = statusGroupsCache?.[boardKey];
    if (cached) {
      setStatusGroups(cached);
      return undefined;
    }

    let cancelled = false;
    const controller = new AbortController();
    setIsLoadingGroups(true);

    fetchStatusGroups(boardKey, controller.signal)
      .then((groups) => {
        if (!cancelled) {
          setStatusGroups(groups);
        }
      })
      .catch((error) => {
        if (error?.code === "ERR_CANCELED" || cancelled) {
          return;
        }
        setStatusGroups([]);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingGroups(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fetchStatusGroups, formState.boardId, isOpen, statusGroupsCache]);

  useEffect(() => {
    if (!isOpen || !formState.boardId) {
      setBoardMembers([]);
      setIsLoadingMembers(false);
      return undefined;
    }

    const boardKey = formState.boardId;
    const cachedMembers = boardMembersCache?.[boardKey];
    if (cachedMembers) {
      setBoardMembers(cachedMembers);
      return undefined;
    }

    let cancelled = false;
    const controller = new AbortController();
    setIsLoadingMembers(true);

    fetchBoardMembers(boardKey, controller.signal)
      .then((members) => {
        if (cancelled) {
          return;
        }
        setBoardMembers(members);
        setFormState((previous) => {
          const allowed = new Set(members.map((member) => String(member.id)));
          const filtered = previous.assigneeIds.filter((id) =>
            allowed.has(String(id))
          );
          if (filtered.length === previous.assigneeIds.length) {
            return previous;
          }
          return {
            ...previous,
            assigneeIds: filtered,
          };
        });
      })
      .catch((error) => {
        if (error?.code === "ERR_CANCELED" || cancelled) {
          return;
        }
        setBoardMembers([]);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingMembers(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [boardMembersCache, fetchBoardMembers, formState.boardId, isOpen]);

  const handleFieldChange = (field) => (event) => {
    const { value } = event.target;
    setFormState((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleAssigneesChange = useCallback((selectedIds) => {
    setFormState((previous) => ({
      ...previous,
      assigneeIds: selectedIds,
    }));
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedTitle = formState.title.trim();
    if (!trimmedTitle) {
      setFormError("Task title is required.");
      return;
    }
    if (!isEditMode && !formState.boardId) {
      setFormError("Please select a board.");
      return;
    }
    if (isEditMode && !task?.id) {
      setFormError("Task not found.");
      return;
    }

    const payload = {
      title: trimmedTitle,
      status: formState.status,
    };

    if (!isEditMode) {
      payload.boardId = formState.boardId;
    }

    if (formState.statusGroupId) {
      payload.statusGroupId = formState.statusGroupId;
    }

    const trimmedTaskGroup = formState.taskGroup.trim();
    if (trimmedTaskGroup || isEditMode) {
      payload.taskGroup = trimmedTaskGroup;
    }

    const trimmedDescription = formState.description.trim();
    if (trimmedDescription || isEditMode) {
      payload.description = trimmedDescription;
    }

    if (formState.plannedStartDate || isEditMode) {
      payload.plannedStartDate = formState.plannedStartDate || null;
    }

    if (formState.plannedEndDate || isEditMode) {
      payload.plannedEndDate = formState.plannedEndDate || null;
    }

    if (formState.assigneeIds.length > 0) {
      payload.assigneeIds = formState.assigneeIds;
    } else if (isEditMode) {
      payload.assigneeIds = [];
    }

    setIsSaving(true);
    setFormError("");

    try {
      if (isEditMode) {
        await onUpdate?.(task.id, payload);
      } else {
        await onCreate?.(payload);
      }
      setIsSaving(false);
      onClose();
    } catch (error) {
      if (error?.code === "ERR_CANCELED") {
        setIsSaving(false);
        return;
      }
      const message =
        error?.response?.data?.message ||
        (isEditMode
          ? "Unable to update the task."
          : "Unable to create the task.");
      setFormError(message);
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving) {
      return;
    }
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  const modalTitle = isEditMode ? "Ажил засах" : "Ажил нэмэх";
  const submitLabel = isSaving
    ? isEditMode
      ? "шинэчилж байна..."
      : "хадгалаж байна..."
    : isEditMode
    ? "Өөрчлөлт хадгалах"
    : "Ажил үүсгэх";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4 py-8">
      <div className="relative w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{modalTitle}</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="max-h-[75vh] overflow-y-auto px-6 py-5"
        >
          {formError ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-5 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600">
              <span>Гарчиг</span>
              <input
                type="text"
                value={formState.title}
                onChange={handleFieldChange("title")}
                className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                placeholder="Гарчиг"
                required
              />
            </label>

            <SelectField
              label="Самбар"
              placeholder="Самбар сонгох"
              value={formState.boardId}
              onChange={(event) => {
                const nextValue = event.target.value;
                setFormState((previous) => ({
                  ...previous,
                  boardId: nextValue,
                  statusGroupId: "",
                  assigneeIds: [],
                }));
              }}
              options={boards.map((board) => ({
                value: String(board.id),
                label: board.name || "Untitled board",
              }))}
              disabled={boards.length === 0 || isEditMode}
            />

            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600">
              <span>Групп</span>
              <select
                value={formState.statusGroupId}
                onChange={handleFieldChange("statusGroupId")}
                className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              >
                <option value="">— Not set —</option>
                {statusGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              {isLoadingGroups ? (
                <span className="text-xs font-medium text-slate-400">
                  Loading groups…
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600">
              <span>Статус</span>
              <select
                value={formState.status}
                onChange={handleFieldChange("status")}
                className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              >
                {TASK_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <MultiSelectField
              label="Хариуцах ажилтан"
              placeholder="Ажилтан"
              values={formState.assigneeIds}
              onChange={handleAssigneesChange}
              options={boardMembers.map((member) => ({
                value: String(member.id),
                label: formatEmployeeName(member),
              }))}
              disabled={!formState.boardId || isLoadingMembers}
            />
            {isLoadingMembers ? (
              <span className="text-xs font-medium text-slate-400">
                Loading members…
              </span>
            ) : null}
            {!isLoadingMembers &&
            formState.boardId &&
            boardMembers.length === 0 ? (
              <span className="text-xs font-medium text-slate-400">
                Энэ самбарт гишүүн алга.
              </span>
            ) : null}
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600">
              <span>Эхлэх огноо</span>
              <input
                type="date"
                value={formState.plannedStartDate}
                onChange={handleFieldChange("plannedStartDate")}
                className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600">
              <span>Дуусах огноо</span>
              <input
                type="date"
                value={formState.plannedEndDate}
                onChange={handleFieldChange("plannedEndDate")}
                className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
          </div>

          <label className="mt-6 flex flex-col gap-2 text-sm font-semibold text-slate-600">
            <span>Тайлбар</span>
            <textarea
              rows={4}
              value={formState.description}
              onChange={handleFieldChange("description")}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              placeholder="Details about the task"
            />
          </label>

          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-800"
            >
              Цуцлах
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white shadow transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TaskTable({
  tasks,
  onAddTask,
  onEditTask,
  onDeleteTask,
  deletingTaskId,
}) {
  const tableHeaders = useMemo(
    () => ["Гарчиг", "Групп", "Самбар", "Ажилчид", "Огноо", "Статус", "Үйлдэл"],
    []
  );

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
      <div className="grid grid-cols-[240px_repeat(4,minmax(0,1fr))_140px_140px] items-center gap-4 border-b border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600">
        {tableHeaders.map((header) => (
          <span key={header}>{header}</span>
        ))}
      </div>
      <div className="divide-y divide-slate-200">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="grid grid-cols-[240px_repeat(4,minmax(0,1fr))_140px_140px] items-center gap-4 px-6 py-3 text-sm text-slate-700"
          >
            <div className="flex items-center gap-3 font-semibold text-slate-900">
              <div className="flex items-center justify-center rounded-full border border-slate-300 p-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  className="h-4 w-4 text-slate-500"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5.25 5.25h13.5m-13.5 0a2.25 2.25 0 00-2.25 2.25v9A2.25 2.25 0 005.25 18.75h13.5a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25m-13.5 0V4.5A2.25 2.25 0 016.75 2.25h10.5A2.25 2.25 0 0119.5 4.5v.75m-6.75 4.5v6m-3-3h6"
                  />
                </svg>
              </div>
              <span>{task.name}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-slate-900" />
              <span className="font-medium text-slate-800">{task.group}</span>
            </div>

            <span className="font-medium text-slate-800">{task.board}</span>

            <div className="flex items-center gap-2">
              {task.assignees.length ? (
                task.assignees.map((member, index) => (
                  <span
                    key={member.id ?? `${member.name}-${index}`}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold uppercase text-white ${getAvatarColor(
                      index
                    )}`}
                    title={member.name}
                  >
                    {buildInitials(member.name)}
                  </span>
                ))
              ) : (
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  —
                </span>
              )}
            </div>

            <span className="font-medium text-slate-800">{task.dateLabel}</span>

            <span
              className={`inline-flex w-max items-center justify-center rounded-full px-3 py-1 text-sm font-semibold ${task.statusBadgeClass}`}
            >
              {task.statusLabel}
            </span>

            <div className="flex flex-wrap items-center gap-2">
              {onEditTask ? (
                <button
                  type="button"
                  onClick={() => onEditTask(task.id)}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                >
                  Засах
                </button>
              ) : null}
              {onDeleteTask ? (
                <button
                  type="button"
                  onClick={() => onDeleteTask(task.id)}
                  disabled={deletingTaskId === task.id}
                  className="rounded-full border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-400 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingTaskId === task.id ? "Устгаж байна..." : "Устгах"}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAddTask}
        disabled={!onAddTask}
        className="w-full border-t border-slate-200 px-6 py-3 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        + Ажил нэмэх
      </button>
    </div>
  );
}

function CalendarView({ tasks }) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [monthCursor, setMonthCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const days = useMemo(
    () => buildCalendarMatrix(monthCursor, tasks),
    [monthCursor, tasks]
  );

  const showPreviousMonth = useCallback(() => {
    setMonthCursor(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  }, []);

  const showNextMonth = useCallback(() => {
    setMonthCursor(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  }, []);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">
          {monthLabelFormatter.format(monthCursor)}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={showPreviousMonth}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-400 hover:text-slate-800"
            aria-label="Previous month"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={showNextMonth}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-400 hover:text-slate-800"
            aria-label="Next month"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 4.5l7.5 7.5-7.5 7.5"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {CALENDAR_WEEKDAY_LABELS.map((weekday) => (
          <div key={weekday} className="px-2 text-center">
            {weekday}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2 text-sm">
        {days.map((day) => {
          const isToday = isSameDay(day.date, today);
          const displayMonth = day.isCurrentMonth
            ? ""
            : dateLabelFormatter.format(day.date).split(" ")[0];
          const visibleTasks = day.tasks.slice(0, 3);
          const extraCount = day.tasks.length - visibleTasks.length;

          return (
            <div
              key={day.key}
              className={`min-h-30 rounded-2xl border border-slate-200 bg-white/60 p-3 transition ${
                isToday ? "border-sky-400 shadow" : "hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
                    isToday ? "bg-sky-500 text-white" : "text-slate-600"
                  }`}
                >
                  {day.date.getDate()}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                  {displayMonth}
                </span>
              </div>
              <ul className="mt-3 space-y-1">
                {visibleTasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"
                    title={buildCalendarTaskTooltip(task)}
                  >
                    <span
                      className={`inline-flex h-2 w-2 rounded-full ${
                        task.statusDotClass || "bg-slate-400"
                      }`}
                    />
                    <span className="truncate">{task.name}</span>
                  </li>
                ))}
                {extraCount > 0 ? (
                  <li className="text-xs font-semibold text-slate-400">
                    +{extraCount} more
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ overview }) {
  const rangeLabel = `${dateLabelFormatter.format(
    overview.start
  )} — ${dateLabelFormatter.format(overview.end)}`;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">
          Энэ долоо хоног
        </h2>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {rangeLabel}
        </span>
      </div>
      <p className="mt-1 text-xs font-medium text-slate-500">
        {overview.total
          ? formatTaskCount(overview.total)
          : "Энэ долоо хоногт ажил алга."}
      </p>
      <div className="mt-5 flex flex-col gap-3">
        {overview.days.map((day) => {
          const dayTasks = day.tasks.length
            ? day.tasks.slice().sort(sortByDueDate)
            : [];
          const containerClasses = `rounded-2xl border bg-white px-4 py-3 ${
            day.isToday ? "border-slate-900 shadow-lg" : "border-slate-200"
          }`;

          return (
            <div key={day.key} className={containerClasses}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span>{day.label}</span>
                  <span className="text-slate-400">{day.dateLabel}</span>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  {formatTaskCount(dayTasks.length)}
                </span>
              </div>
              {dayTasks.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-2">
                  {dayTasks.map((task) => (
                    <li
                      key={task.id}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                      title={buildCalendarTaskTooltip(task)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">
                          {task.name}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${task.statusBadgeClass}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${task.statusDotClass}`}
                            aria-hidden="true"
                          />
                          {task.statusLabel}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{task.board}</span>
                        <span
                          className="h-1 w-1 rounded-full bg-slate-300"
                          aria-hidden="true"
                        />
                        <span>{task.group}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs font-semibold text-slate-400">
                  Ажил байхгүй
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SelectField({
  label,
  placeholder,
  value,
  onChange,
  options,
  disabled = false,
}) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  const activeOption = options.find((option) => option.value === value);
  const displayLabel = activeOption?.label || placeholder || "Сонгох";
  const isPlaceholder = !activeOption;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (
        triggerRef.current?.contains(event.target) ||
        menuRef.current?.contains(event.target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (disabled && isOpen) {
      setIsOpen(false);
    }
  }, [disabled, isOpen]);

  const handleToggle = () => {
    if (disabled) {
      return;
    }
    setIsOpen((previous) => !previous);
  };

  const handleSelect = (nextValue) => {
    onChange?.({ target: { value: nextValue } });
    setIsOpen(false);
  };

  return (
    <label className="flex  ml-4 w-60 items-center justify-center gap-2 text-sm font-semibold text-slate-600">
      <span>{label}</span>
      <div className="relative w-full">
        <button
          type="button"
          ref={triggerRef}
          onClick={handleToggle}
          disabled={disabled}
          className={`flex h-12 w-full items-center justify-between rounded-2xl border bg-white px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60 ${
            isOpen
              ? "border-sky-400 text-slate-800 shadow-sm"
              : "border-slate-200 text-slate-700 hover:border-sky-300"
          }`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span
            className={`truncate ${
              isPlaceholder ? "text-slate-400 font-medium" : ""
            }`}
          >
            {displayLabel}
          </span>
          <span className="ml-3 inline-flex items-center text-slate-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className={`h-4 w-4 transition-transform ${
                isOpen ? "rotate-180" : ""
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

        {isOpen ? (
          <div
            ref={menuRef}
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-2xl border border-slate-200 bg-white py-1 shadow-[0_20px_40px_rgba(15,23,42,0.08)]"
          >
            <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
              {options.length === 0 ? (
                <li className="px-4 py-2 text-sm font-medium text-slate-400">
                  Сонголт байхгүй
                </li>
              ) : (
                options.map((option) => {
                  const isActive = option.value === value;
                  return (
                    <li key={option.value}>
                      <button
                        type="button"
                        onClick={() => handleSelect(option.value)}
                        className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm font-medium transition hover:bg-slate-50 ${
                          isActive ? "text-sky-600" : "text-slate-600"
                        }`}
                        role="option"
                        aria-selected={isActive}
                      >
                        {option.label}
                        {isActive ? (
                          <span className="text-xs font-semibold uppercase tracking-wide text-sky-500">
                            ✓
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </label>
  );
}

function MultiSelectField({
  label,
  placeholder,
  values = [],
  onChange,
  options = [],
  disabled = false,
}) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const selectedOptions = useMemo(
    () => options.filter((option) => values.includes(option.value)),
    [options, values]
  );

  const summaryLabel = selectedOptions.length
    ? (() => {
        const [first, ...rest] = selectedOptions;
        if (rest.length === 0) {
          return first.label;
        }
        return `${first.label} +${rest.length}`;
      })()
    : placeholder || "Сонгох";

  const normalizedSearch = searchValue.trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    if (!normalizedSearch) {
      return options;
    }
    return options.filter((option) =>
      option.label.toLowerCase().includes(normalizedSearch)
    );
  }, [normalizedSearch, options]);

  useEffect(() => {
    if (!isOpen && searchValue) {
      setSearchValue("");
    }
  }, [isOpen, searchValue]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (
        triggerRef.current?.contains(event.target) ||
        menuRef.current?.contains(event.target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (disabled && isOpen) {
      setIsOpen(false);
    }
  }, [disabled, isOpen]);

  const toggleOpen = () => {
    if (disabled) {
      return;
    }
    setIsOpen((previous) => !previous);
  };

  const toggleSelection = (optionValue) => {
    if (!onChange) {
      return;
    }
    const isSelected = values.includes(optionValue);
    const nextValues = isSelected
      ? values.filter((item) => item !== optionValue)
      : [...values, optionValue];
    onChange(nextValues);
  };

  const handleClear = () => {
    onChange?.([]);
  };

  return (
    <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600">
      <span>{label}</span>
      <div className="relative w-full">
        <button
          type="button"
          ref={triggerRef}
          onClick={toggleOpen}
          disabled={disabled}
          className={`flex h-12 w-full items-center justify-between rounded-2xl border bg-white px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60 ${
            isOpen
              ? "border-sky-400 text-slate-800 shadow-sm"
              : "border-slate-200 text-slate-700 hover:border-sky-300"
          }`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span
            className={`truncate ${
              selectedOptions.length === 0 ? "text-slate-400 font-medium" : ""
            }`}
          >
            {summaryLabel}
          </span>
          <span className="ml-3 inline-flex items-center text-slate-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className={`h-4 w-4 transition-transform ${
                isOpen ? "rotate-180" : ""
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

        {isOpen ? (
          <div
            ref={menuRef}
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 rounded-2xl border border-slate-200 bg-white py-3 shadow-[0_20px_40px_rgba(15,23,42,0.08)]"
          >
            <div className="px-3 pb-3">
              <Searchbar
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder={placeholder || "Сонгох"}
                className="border-slate-200"
              />
              <div className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Сонгосон: {values.length}</span>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-sky-600 transition hover:text-sky-700"
                >
                  Цэвэрлэх
                </button>
              </div>
            </div>

            <ul role="listbox" className="max-h-64 overflow-y-auto px-3 pb-1">
              {filteredOptions.length === 0 ? (
                <li className="px-3 py-2 text-sm font-medium text-slate-400">
                  Таарсан үр дүн алга
                </li>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = values.includes(option.value);
                  return (
                    <li key={option.value} className="py-1">
                      <button
                        type="button"
                        onClick={() => toggleSelection(option.value)}
                        className={`flex w-full items-center justify-between rounded-2xl px-4 py-2 text-left text-sm font-semibold transition hover:bg-slate-50 ${
                          isSelected
                            ? "bg-slate-100 text-sky-600"
                            : "text-slate-600"
                        }`}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <span className="truncate">{option.label}</span>
                        <span
                          className={`ml-4 inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                            isSelected
                              ? "border-sky-500 bg-sky-500 text-white"
                              : "border-slate-300"
                          }`}
                        >
                          {isSelected ? "✓" : ""}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </label>
  );
}

function CreateTaskModal({
  isOpen,
  onClose,
  boards,
  defaultBoardId,
  onSubmit,
  fetchStatusGroups,
  statusGroupsCache,
  fetchBoardMembers,
  boardMembersCache,
}) {
  const [formState, setFormState] = useState(() =>
    createInitialFormState(defaultBoardId)
  );
  const [statusGroups, setStatusGroups] = useState([]);
  const [boardMembers, setBoardMembers] = useState([]);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormState(createInitialFormState(defaultBoardId));
      setStatusGroups([]);
      setBoardMembers([]);
      setFormError("");
    }
  }, [defaultBoardId, isOpen]);

  useEffect(() => {
    if (!isOpen || !formState.boardId) {
      setStatusGroups([]);
      return undefined;
    }

    const boardKey = formState.boardId;
    const cached = statusGroupsCache?.[boardKey];
    if (cached) {
      setStatusGroups(cached);
      return undefined;
    }

    let cancelled = false;
    const controller = new AbortController();
    setIsLoadingGroups(true);

    fetchStatusGroups(boardKey, controller.signal)
      .then((groups) => {
        if (!cancelled) {
          setStatusGroups(groups);
        }
      })
      .catch((error) => {
        if (error?.code === "ERR_CANCELED" || cancelled) {
          return;
        }
        setStatusGroups([]);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingGroups(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fetchStatusGroups, formState.boardId, isOpen, statusGroupsCache]);

  useEffect(() => {
    if (!isOpen || !formState.boardId) {
      setBoardMembers([]);
      setIsLoadingMembers(false);
      return undefined;
    }

    const boardKey = formState.boardId;
    const cachedMembers = boardMembersCache?.[boardKey];
    if (cachedMembers) {
      setBoardMembers(cachedMembers);
      return undefined;
    }

    let cancelled = false;
    const controller = new AbortController();
    setIsLoadingMembers(true);

    fetchBoardMembers(boardKey, controller.signal)
      .then((members) => {
        if (cancelled) {
          return;
        }
        setBoardMembers(members);
        setFormState((previous) => {
          const allowed = new Set(members.map((member) => String(member.id)));
          const filtered = previous.assigneeIds.filter((id) =>
            allowed.has(String(id))
          );
          if (filtered.length === previous.assigneeIds.length) {
            return previous;
          }
          return {
            ...previous,
            assigneeIds: filtered,
          };
        });
      })
      .catch((error) => {
        if (error?.code === "ERR_CANCELED" || cancelled) {
          return;
        }
        setBoardMembers([]);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingMembers(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [boardMembersCache, fetchBoardMembers, formState.boardId, isOpen]);

  const handleFieldChange = (field) => (event) => {
    const { value } = event.target;
    setFormState((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleAssigneesChange = useCallback(
    (selectedIds) => {
      setFormState((previous) => ({
        ...previous,
        assigneeIds: selectedIds,
      }));
    },
    [setFormState]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedTitle = formState.title.trim();
    if (!trimmedTitle) {
      setFormError("Task title is required.");
      return;
    }
    if (!formState.boardId) {
      setFormError("Please select a board.");
      return;
    }

    const payload = {
      boardId: formState.boardId,
      title: trimmedTitle,
      status: formState.status,
    };

    if (formState.statusGroupId) {
      payload.statusGroupId = formState.statusGroupId;
    }
    if (formState.taskGroup.trim()) {
      payload.taskGroup = formState.taskGroup.trim();
    }
    if (formState.description.trim()) {
      payload.description = formState.description.trim();
    }
    if (formState.plannedStartDate) {
      payload.plannedStartDate = formState.plannedStartDate;
    }
    if (formState.plannedEndDate) {
      payload.plannedEndDate = formState.plannedEndDate;
    }
    if (formState.assigneeIds.length > 0) {
      payload.assigneeIds = formState.assigneeIds;
    }

    setIsSaving(true);
    setFormError("");

    try {
      await onSubmit(payload);
      setIsSaving(false);
      onClose();
    } catch (error) {
      if (error?.code === "ERR_CANCELED") {
        setIsSaving(false);
        return;
      }
      const message =
        error?.response?.data?.message || "Unable to create the task.";
      setFormError(message);
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving) {
      return;
    }
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4 py-8">
      <div className="relative w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Ажил нэмэх</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="max-h-[75vh] overflow-y-auto px-6 py-5"
        >
          {formError ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-5 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600">
              <span>Гарчиг</span>
              <input
                type="text"
                value={formState.title}
                onChange={handleFieldChange("title")}
                className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                placeholder="Гарчиг"
                required
              />
            </label>

            <SelectField
              label="Самбар"
              placeholder="Самбар сонгох"
              value={formState.boardId}
              onChange={(event) => {
                const nextValue = event.target.value;
                setFormState((previous) => ({
                  ...previous,
                  boardId: nextValue,
                  statusGroupId: "",
                  assigneeIds: [],
                }));
              }}
              options={boards.map((board) => ({
                value: String(board.id),
                label: board.name || "Untitled board",
              }))}
              disabled={boards.length === 0}
            />

            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600">
              <span>Групп</span>
              <select
                value={formState.statusGroupId}
                onChange={handleFieldChange("statusGroupId")}
                className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              >
                <option value="">— Not set —</option>
                {statusGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              {isLoadingGroups ? (
                <span className="text-xs font-medium text-slate-400">
                  Loading groups…
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600">
              <span>Статус</span>
              <select
                value={formState.status}
                onChange={handleFieldChange("status")}
                className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              >
                {TASK_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <MultiSelectField
              label="Хариуцах ажилтан"
              placeholder="Ажилтан"
              values={formState.assigneeIds}
              onChange={handleAssigneesChange}
              options={boardMembers.map((member) => ({
                value: String(member.id),
                label: formatEmployeeName(member),
              }))}
              disabled={!formState.boardId || isLoadingMembers}
            />
            {isLoadingMembers ? (
              <span className="text-xs font-medium text-slate-400">
                Loading members…
              </span>
            ) : null}
            {!isLoadingMembers &&
            formState.boardId &&
            boardMembers.length === 0 ? (
              <span className="text-xs font-medium text-slate-400">
                Энэ самбарт гишүүн алга.
              </span>
            ) : null}
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600">
              <span>Эхлэх огноо</span>
              <input
                type="date"
                value={formState.plannedStartDate}
                onChange={handleFieldChange("plannedStartDate")}
                className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600">
              <span>Дуусах огноо</span>
              <input
                type="date"
                value={formState.plannedEndDate}
                onChange={handleFieldChange("plannedEndDate")}
                className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
          </div>

          <label className="mt-6 flex flex-col gap-2 text-sm font-semibold text-slate-600">
            <span>Тайлбар</span>
            <textarea
              rows={4}
              value={formState.description}
              onChange={handleFieldChange("description")}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              placeholder="Details about the task"
            />
          </label>

          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-800"
            >
              Цуцлах
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white shadow transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? "хадгалаж байна..." : "Ажил үүсгэх"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AllTasks() {
  const [tasks, setTasks] = useState([]);
  const [boards, setBoards] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [activeView, setActiveView] = useState("table");
  const [collapsedSections, setCollapsedSections] = useState(() => new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewFilter, setViewFilter] = useState("all");
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskModalMode, setTaskModalMode] = useState("create");
  const [taskToEdit, setTaskToEdit] = useState(null);
  const [deletingTaskId, setDeletingTaskId] = useState(null);

  const statusGroupsCacheRef = useRef({});
  const boardMembersCacheRef = useRef({});

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadData = async () => {
      setIsLoading(true);
      setFetchError("");
      try {
        const [tasksResponse, boardsResponse, employeesResponse] =
          await Promise.all([
            apiClient.get("/tasks", {
              params: { page: 1, pageSize: 200 },
              signal: controller.signal,
            }),
            apiClient.get("/boards", { signal: controller.signal }),
            apiClient.get("/employees", {
              params: { page: 1, pageSize: 200 },
              signal: controller.signal,
            }),
          ]);

        if (!isMounted) {
          return;
        }

        setTasks(tasksResponse.data?.data ?? []);
        setBoards(boardsResponse.data?.data ?? []);
        setEmployees(employeesResponse.data?.data ?? []);
      } catch (error) {
        if (error?.code === "ERR_CANCELED" || !isMounted) {
          return;
        }
        const message =
          error?.response?.data?.message || "Unable to load tasks overview.";
        setFetchError(message);
        setTasks([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const refreshTasks = useCallback(async () => {
    setIsRefreshing(true);
    setFetchError("");
    try {
      const response = await apiClient.get("/tasks", {
        params: { page: 1, pageSize: 200 },
      });
      setTasks(response.data?.data ?? []);
    } catch (error) {
      const message =
        error?.response?.data?.message || "Unable to refresh tasks.";
      setFetchError(message);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleTaskCreated = useCallback(
    async (payload) => {
      const response = await apiClient.post("/tasks", payload);
      await refreshTasks();

      return response.data?.task;
    },
    [refreshTasks]
  );

  const handleTaskUpdated = useCallback(
    async (taskId, payload) => {
      const response = await apiClient.patch(`/tasks/${taskId}`, payload);
      await refreshTasks();
      return response.data?.task;
    },
    [refreshTasks]
  );

  const fetchStatusGroups = useCallback(async (boardId, signal) => {
    if (!boardId) {
      return [];
    }
    const key = String(boardId);
    const cached = statusGroupsCacheRef.current[key];
    if (cached) {
      return cached;
    }
    const response = await apiClient.get(
      `/boards/${encodeURIComponent(key)}/status-groups`,
      {
        signal,
      }
    );
    const groups = response.data?.data ?? [];
    statusGroupsCacheRef.current[key] = groups;
    return groups;
  }, []);

  const fetchBoardMembers = useCallback(async (boardId, signal) => {
    if (!boardId) {
      return [];
    }
    const key = String(boardId);
    const cached = boardMembersCacheRef.current[key];
    if (cached) {
      return cached;
    }
    const response = await apiClient.get(
      `/boards/${encodeURIComponent(key)}/members`,
      {
        signal,
      }
    );
    const members = response.data?.data ?? [];
    boardMembersCacheRef.current[key] = members;
    return members;
  }, []);

  const openCreateModal = useCallback(() => {
    setTaskModalMode("create");
    setTaskToEdit(null);
    setIsTaskModalOpen(true);
  }, []);

  const handleEditTask = useCallback(
    (taskId) => {
      const sourceTask = tasks.find((task) => task.id === taskId);
      if (!sourceTask) {
        return;
      }
      setTaskModalMode("edit");
      setTaskToEdit(sourceTask);
      setIsTaskModalOpen(true);
    },
    [tasks]
  );

  const handleDeleteTask = useCallback(
    async (taskId) => {
      const confirmed = window.confirm("Энэ ажлыг устгах уу?");
      if (!confirmed) {
        return;
      }
      setDeletingTaskId(taskId);
      setFetchError("");
      try {
        await apiClient.delete(`/tasks/${taskId}`);
        await refreshTasks();
      } catch (error) {
        const message =
          error?.response?.data?.message || "Unable to delete the task.";
        setFetchError(message);
      } finally {
        setDeletingTaskId(null);
      }
    },
    [refreshTasks]
  );

  const toggleSection = useCallback((sectionId) => {
    setCollapsedSections((previous) => {
      const next = new Set(previous);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const boardsById = useMemo(() => {
    const map = new Map();
    boards.forEach((board) => {
      map.set(board.id, board.name || "Untitled board");
    });
    return map;
  }, [boards]);

  const employeesById = useMemo(() => {
    const map = new Map();
    employees.forEach((employee) => {
      const name =
        [employee.first_name, employee.last_name].filter(Boolean).join(" ") ||
        employee.employee_code ||
        "Employee";
      map.set(employee.id, { id: employee.id, name });
    });
    return map;
  }, [employees]);

  const normalizedTasks = useMemo(
    () =>
      tasks.map((task) => {
        const dueDate =
          parseDate(task.planned_end_date) ||
          parseDate(task.planned_start_date);
        const dueDateStart = dueDate ? startOfDay(dueDate) : null;
        const statusKey = resolveStatusKey(task.status);
        const statusMeta = STATUS_STYLES[statusKey] ?? STATUS_STYLES.working;

        return {
          id: task.id,
          name: task.title || "Untitled Task",
          group: task.status_group || task.task_group || "—",
          board: boardsById.get(task.board_id) || "—",
          boardId: task.board_id ? String(task.board_id) : "",
          assignees: (task.assignees ?? []).map((employeeId, index) => {
            const employee = employeesById.get(employeeId);
            return {
              id: `${employeeId}-${index}`,
              name: employee?.name ?? "Unassigned",
            };
          }),
          dueDate,
          dueDateStart,
          dueDateKey: dueDateStart ? formatDateKey(dueDateStart) : null,
          dateLabel: dueDateStart
            ? dateLabelFormatter.format(dueDateStart)
            : "—",
          statusKey,
          statusLabel: task.status || statusMeta.label,
          statusBadgeClass: statusMeta.badgeClass,
          statusDotClass: statusMeta.dotClass,
        };
      }),
    [boardsById, employeesById, tasks]
  );

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredTasks = useMemo(() => {
    return normalizedTasks.filter((task) => {
      if (!normalizedSearch) {
        return true;
      }

      const nameMatch = task.name.toLowerCase().includes(normalizedSearch);
      const boardMatch = task.board.toLowerCase().includes(normalizedSearch);
      const groupMatch = (task.group || "")
        .toLowerCase()
        .includes(normalizedSearch);

      return nameMatch || boardMatch || groupMatch;
    });
  }, [normalizedSearch, normalizedTasks]);

  const sections = useMemo(
    () => buildSections(filteredTasks, viewFilter),
    [filteredTasks, viewFilter]
  );

  const calendarTasks = useMemo(
    () => filteredTasks.filter((task) => task.dueDateStart),
    [filteredTasks]
  );

  const currentWeekOverview = useMemo(() => {
    const today = startOfDay(new Date());
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);
      const dayTasks = calendarTasks.filter(
        (task) => task.dueDateStart && isSameDay(task.dueDateStart, date)
      );

      return {
        key: formatDateKey(date),
        date,
        label: weekdayLabelFormatter.format(date),
        dateLabel: dateLabelFormatter.format(date),
        isToday: isSameDay(date, today),
        tasks: dayTasks,
      };
    });

    const total = days.reduce(
      (accumulator, day) => accumulator + day.tasks.length,
      0
    );

    return {
      start: weekStart,
      end: weekEnd,
      total,
      days,
    };
  }, [calendarTasks]);

  return (
    <section className="min-h-full mx-6 rounded-[30px] bg-white px-6 pb-12 pt-8 shadow-lg">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold text-slate-900">Ажилууд</h1>
          <div className="flex flex-wrap items-center gap-3">
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

            {activeView !== "calendar" ? (
              <>
                <div className="relative w-125">
                  <Searchbar
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Ажил"
                  />
                </div>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-2 rounded-[14px] bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-slate-800"
                >
                  Ажил нэмэх
                </button>
              </>
            ) : null}
          </div>
          {isRefreshing ? (
            <span className="text-xs font-medium text-slate-400">
              Refreshing tasks…
            </span>
          ) : null}
        </div>

        <div className="flex flex-col w-100 items-center gap-3 self-end sm:flex-row sm:items-start">
          <Link to="/tasks/boards" className="inline-flex self-center">
            <BlackButton
              label="Самбарууд"
              className="rounded-xl px-5 py-2 text-sm font-semibold shadow-sm h-12"
            />
          </Link>

          {activeView !== "calendar" ? (
            <div className="w-full self-center sm:w-52">
              <SelectField
                label="Ангилах"
                placeholder="Он сараар"
                value={viewFilter}
                onChange={(event) => setViewFilter(event.target.value)}
                options={VIEW_FILTER_OPTIONS}
              />
            </div>
          ) : null}
        </div>
      </header>

      {fetchError ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {fetchError}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-10 rounded-2xl border border-slate-200 bg-white/70 px-6 py-6 text-sm font-medium text-slate-500">
          Loading tasks…
        </div>
      ) : null}

      {!isLoading && filteredTasks.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-6 text-sm font-medium text-slate-500">
          No tasks match the current filters.
        </div>
      ) : null}

      {!isLoading && filteredTasks.length > 0 ? (
        activeView === "table" ? (
          <div className="mt-10 flex flex-col gap-8">
            {sections.map((section) => {
              const isCollapsed = collapsedSections.has(section.id);
              return (
                <div
                  key={section.id}
                  className="rounded-[26px] bg-white/60 p-4 shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className="flex w-full items-center justify-between gap-4 text-left"
                    aria-expanded={!isCollapsed}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white transition ${
                          isCollapsed ? "rotate-[-90deg]" : ""
                        }`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth="1.5"
                          stroke="currentColor"
                          className="h-4 w-4 text-slate-600"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8.25 4.5l7.5 7.5-7.5 7.5"
                          />
                        </svg>
                      </span>
                      <div className="flex items-baseline gap-3">
                        <h2 className="text-xl font-semibold text-slate-900">
                          {section.title}
                        </h2>
                        <span className="text-sm font-medium text-slate-500">
                          {section.countLabel}
                        </span>
                      </div>
                    </div>
                  </button>

                  {!isCollapsed && section.tasks.length > 0 ? (
                    <TaskTable
                      tasks={section.tasks}
                      onAddTask={openCreateModal}
                      onEditTask={handleEditTask}
                      onDeleteTask={handleDeleteTask}
                      deletingTaskId={deletingTaskId}
                    />
                  ) : null}

                  {!isCollapsed && section.tasks.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white/70 px-6 py-4 text-sm font-medium text-slate-500">
                      Ажил олдсонгүй.
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
            <CalendarView tasks={calendarTasks} />
            <WeekView overview={currentWeekOverview} />
          </div>
        )
      ) : null}

      <TaskModal
        isOpen={isTaskModalOpen}
        mode={taskModalMode}
        task={taskToEdit}
        onClose={() => {
          setIsTaskModalOpen(false);
          setTaskToEdit(null);
        }}
        boards={boards}
        defaultBoardId={boards[0]?.id ? String(boards[0].id) : ""}
        onCreate={handleTaskCreated}
        onUpdate={handleTaskUpdated}
        fetchStatusGroups={fetchStatusGroups}
        statusGroupsCache={statusGroupsCacheRef.current}
        fetchBoardMembers={fetchBoardMembers}
        boardMembersCache={boardMembersCacheRef.current}
      />
    </section>
  );
}

export default AllTasks;
