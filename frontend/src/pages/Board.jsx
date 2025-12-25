import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import apiClient from "../utils/apiClient";
import Searchbar from "../components/Searchbar";

const updatedAtFormatter = new Intl.DateTimeFormat("mn-MN", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const dueDateFormatter = new Intl.DateTimeFormat("mn-MN", {
  month: "short",
  day: "numeric",
});

const statusPalette = {
  working: {
    label: "Working On It",
    chip: "bg-sky-100 text-sky-700",
    dot: "bg-sky-500",
  },
  pending: {
    label: "Pending",
    chip: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
  },
  onHold: {
    label: "On Hold",
    chip: "bg-slate-200 text-slate-700",
    dot: "bg-slate-400",
  },
  stuck: {
    label: "Stuck",
    chip: "bg-rose-100 text-rose-700",
    dot: "bg-rose-500",
  },
  completed: {
    label: "Completed",
    chip: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
  },
  unknown: {
    label: "Unassigned",
    chip: "bg-slate-100 text-slate-500",
    dot: "bg-slate-400",
  },
};

const TASK_STATUS_OPTIONS = [
  { value: "Working On It", label: "Working On It" },
  { value: "Pending", label: "Pending" },
  { value: "On Hold", label: "On Hold" },
  { value: "Stuck", label: "Stuck" },
  { value: "Completed", label: "Completed" },
];

const normalizeStatusKey = (value) => {
  if (!value) {
    return "unknown";
  }
  const normalized = value.trim().toLowerCase();
  if (["working on it", "working", "in progress"].includes(normalized)) {
    return "working";
  }
  if (["pending", "waiting"].includes(normalized)) {
    return "pending";
  }
  if (["on hold", "paused"].includes(normalized)) {
    return "onHold";
  }
  if (["stuck", "blocked"].includes(normalized)) {
    return "stuck";
  }
  if (["completed", "done", "finished"].includes(normalized)) {
    return "completed";
  }
  return "unknown";
};

const parseDate = (value) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildMemberName = (member) => {
  const first = member?.first_name?.trim();
  const last = member?.last_name?.trim();
  const parts = [first, last].filter(Boolean);
  if (parts.length) {
    return parts.join(" ");
  }
  return member?.email || "Гишүүн";
};

const buildMemberInitials = (member) => {
  const first = member?.first_name?.trim();
  const last = member?.last_name?.trim();
  const initials = `${first ? first[0] : ""}${last ? last[0] : ""}`.trim();
  if (initials) {
    return initials.toUpperCase();
  }
  const email = member?.email?.trim();
  if (email) {
    return email[0]?.toUpperCase() ?? "?";
  }
  return "?";
};

const formatBoardMeta = (board) => {
  if (!board?.updated_at) {
    return "Сүүлд шинэчлэгдээгүй";
  }
  const parsed = parseDate(board.updated_at);
  if (!parsed) {
    return "Сүүлд шинэчлэгдээгүй";
  }
  return `${updatedAtFormatter.format(parsed)} шинэчлэгдсэн`;
};

const MetricCard = ({ accent, label, value, caption }) => (
  <article className="rounded-3xl border border-[#ECEEF3] bg-[#F9FAFB] p-5">
    <div className="flex items-center gap-3">
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold text-white ${accent}`}
      >
        {label[0]}
      </span>
      <div>
        <p className="text-sm text-[#6F767E]">{label}</p>
        <p className="text-2xl font-semibold text-[#111827]">{value}</p>
      </div>
    </div>
    {caption ? <p className="mt-4 text-sm text-[#6F767E]">{caption}</p> : null}
  </article>
);

const EmptyColumnState = ({ description }) => (
  <div className="rounded-2xl border border-dashed border-[#D3D7DF] bg-white/60 p-6 text-center text-sm text-[#6F767E]">
    {description}
  </div>
);

const createInitialTaskFormState = (board, statusGroups, task) => {
  const defaultBoardId = board?.id ? String(board.id) : "";
  const defaultStatusGroupId = statusGroups[0]?.id
    ? String(statusGroups[0].id)
    : "";

  if (task) {
    const resolvedAssignees = Array.isArray(task.assignees)
      ? task.assignees
          .filter(
            (assigneeId) =>
              typeof assigneeId === "number" || typeof assigneeId === "string"
          )
          .map((assigneeId) => String(assigneeId))
      : [];

    return {
      title: task.title || "",
      boardId: task.board_id ? String(task.board_id) : defaultBoardId,
      statusGroupId: task.status_group_id
        ? String(task.status_group_id)
        : defaultStatusGroupId,
      status: task.status || TASK_STATUS_OPTIONS[0]?.value || "Working On It",
      plannedStartDate: task.planned_start_date || "",
      plannedEndDate: task.planned_end_date || "",
      description: task.description || "",
      assigneeIds: resolvedAssignees,
    };
  }

  return {
    title: "",
    boardId: defaultBoardId,
    statusGroupId: defaultStatusGroupId,
    status: TASK_STATUS_OPTIONS[0]?.value ?? "Working On It",
    plannedStartDate: "",
    plannedEndDate: "",
    description: "",
    assigneeIds: [],
  };
};

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
    <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600">
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
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 rounded-2xl border border-slate-200 bg-white py-1 shadow-[0_20px_40px_rgba(15,23,42,0.08)]"
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

function TaskModal({
  isOpen,
  mode = "create",
  task,
  onClose,
  board,
  statusGroups,
  members,
  onCreate,
  onUpdate,
}) {
  const isEditMode = mode === "edit" && task;
  const [formState, setFormState] = useState(() =>
    createInitialTaskFormState(board, statusGroups, task)
  );
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormState(createInitialTaskFormState(board, statusGroups, task));
      setFormError("");
    }
  }, [board, isOpen, statusGroups, task]);

  const boardOptions = board?.id
    ? [
        {
          value: String(board.id),
          label: board.name || "Untitled board",
        },
      ]
    : [];

  const statusGroupOptions = useMemo(
    () =>
      statusGroups.map((group) => ({
        value: String(group.id),
        label: group.name || "Тодорхойгүй",
      })),
    [statusGroups]
  );

  const employeeOptions = useMemo(
    () =>
      members.map((member) => {
        const fullName = [member.first_name, member.last_name]
          .filter(Boolean)
          .join(" ")
          .trim();
        return {
          value: String(member.id),
          label: fullName || member.email || "Employee",
        };
      }),
    [members]
  );

  const handleFieldChange = useCallback(
    (field) => (event) => {
      const { value } = event.target;
      setFormState((previous) => ({
        ...previous,
        [field]: value,
      }));
      if (formError) {
        setFormError("");
      }
    },
    [formError]
  );

  const handleAssigneesChange = useCallback(
    (selectedIds) => {
      setFormState((previous) => ({
        ...previous,
        assigneeIds: selectedIds,
      }));
      if (formError) {
        setFormError("");
      }
    },
    [formError]
  );

  const handleClose = useCallback(() => {
    if (isSaving) {
      return;
    }
    onClose?.();
  }, [isSaving, onClose]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedTitle = formState.title.trim();
    if (!trimmedTitle) {
      setFormError("Ажлын гарчиг шаардлагатай.");
      return;
    }

    if (!formState.boardId) {
      setFormError("Самбар сонгоно уу.");
      return;
    }

    const description = formState.description.trim();

    const statusGroupIdValue = formState.statusGroupId || null;
    const assigneeIds = formState.assigneeIds
      .map((id) => Number(id))
      .filter((value) => Number.isFinite(value));

    const payload = {
      title: trimmedTitle,
      description: description || null,
      plannedStartDate: formState.plannedStartDate || null,
      plannedEndDate: formState.plannedEndDate || null,
      status: formState.status,
      assigneeIds,
      statusGroupId: statusGroupIdValue,
    };

    setIsSaving(true);
    setFormError("");

    try {
      if (isEditMode) {
        await onUpdate?.(task.id, payload);
      } else {
        await onCreate?.({
          ...payload,
          boardId: formState.boardId,
        });
      }
      setIsSaving(false);
      onClose?.();
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        "Өгөгдлийг хадгалах явцад алдаа гарлаа.";
      setFormError(message);
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 px-4">
      <div className="relative w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEditMode ? "Ажил засах" : "Ажил нэмэх"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
            disabled={isSaving}
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
                disabled={isSaving}
              />
            </label>

            <SelectField
              label="Самбар"
              placeholder="Самбар сонгох"
              value={formState.boardId}
              onChange={handleFieldChange("boardId")}
              options={boardOptions}
              disabled={boardOptions.length <= 1 || isSaving}
            />

            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600">
              <span>Групп</span>
              <select
                value={formState.statusGroupId}
                onChange={handleFieldChange("statusGroupId")}
                className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                disabled={isSaving || statusGroupOptions.length === 0}
              >
                <option value="">— Not set —</option>
                {statusGroupOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {statusGroupOptions.length === 0 ? (
                <span className="text-xs font-medium text-slate-400">
                  Эхлээд багана нэмнэ үү.
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600">
              <span>Статус</span>
              <select
                value={formState.status}
                onChange={handleFieldChange("status")}
                className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                disabled={isSaving}
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
              options={employeeOptions}
              disabled={employeeOptions.length === 0 || isSaving}
            />
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600">
              <span>Эхлэх огноо</span>
              <input
                type="date"
                value={formState.plannedStartDate ?? ""}
                onChange={handleFieldChange("plannedStartDate")}
                className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                disabled={isSaving}
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600">
              <span>Дуусах огноо</span>
              <input
                type="date"
                value={formState.plannedEndDate ?? ""}
                onChange={handleFieldChange("plannedEndDate")}
                className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                disabled={isSaving}
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
              disabled={isSaving}
            />
          </label>

          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSaving}
            >
              Цуцлах
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white shadow transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving
                ? "хадгалаж байна..."
                : isEditMode
                ? "Ажил шинэчлэх"
                : "Ажил үүсгэх"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Board() {
  const { boardId } = useParams();
  const [boardState, setBoardState] = useState({
    data: null,
    loading: true,
    error: "",
  });
  const [workspaceState, setWorkspaceState] = useState({
    name: "",
    loading: false,
    error: "",
  });
  const [statusGroupsState, setStatusGroupsState] = useState({
    items: [],
    loading: true,
    error: "",
  });
  const [tasksState, setTasksState] = useState({
    items: [],
    loading: true,
    error: "",
  });
  const [membersState, setMembersState] = useState({
    items: [],
    loading: true,
    error: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusForm, setStatusForm] = useState({ name: "" });
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [taskModalState, setTaskModalState] = useState({
    isOpen: false,
    mode: "create",
    task: null,
  });
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [activeDropColumn, setActiveDropColumn] = useState(null);

  useEffect(() => {
    if (!boardId) {
      setBoardState({ data: null, loading: false, error: "Самбар олдсонгүй." });
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    const fetchBoard = async () => {
      setBoardState({ data: null, loading: true, error: "" });
      setWorkspaceState({ name: "", loading: true, error: "" });
      try {
        const response = await apiClient.get(`/boards/${boardId}`, {
          signal: controller.signal,
        });
        if (!isMounted) {
          return;
        }
        const board = response.data?.board ?? null;
        if (!board) {
          setBoardState({
            data: null,
            loading: false,
            error: "Самбар олдсонгүй.",
          });
          setWorkspaceState({ name: "", loading: false, error: "" });
          return;
        }
        setBoardState({ data: board, loading: false, error: "" });
        setWorkspaceState({
          name: board.workspace_name || "",
          loading: false,
          error: "",
        });
      } catch (error) {
        if (!isMounted || controller.signal.aborted) {
          return;
        }
        const message =
          error?.response?.data?.message ||
          "Самбарын мэдээлэл татахад алдаа гарлаа.";
        setBoardState({ data: null, loading: false, error: message });
        setWorkspaceState({
          name: "",
          loading: false,
          error: message,
        });
      }
    };

    fetchBoard();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [boardId]);

  useEffect(() => {
    if (!boardState.data?.id) {
      setStatusGroupsState((prev) => ({ ...prev, items: [] }));
      setTasksState((prev) => ({ ...prev, items: [] }));
      setMembersState((prev) => ({ ...prev, items: [] }));
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    const fetchBoardDetails = async () => {
      setStatusGroupsState({ items: [], loading: true, error: "" });
      setTasksState({ items: [], loading: true, error: "" });
      setMembersState({ items: [], loading: true, error: "" });

      try {
        const [groupsResponse, tasksResponse, membersResponse] =
          await Promise.all([
            apiClient.get(`/boards/${boardState.data.id}/status-groups`, {
              signal: controller.signal,
            }),
            apiClient.get("/tasks", {
              params: { page: 1, pageSize: 200, boardId: boardState.data.id },
              signal: controller.signal,
            }),
            apiClient.get(`/boards/${boardState.data.id}/members`, {
              signal: controller.signal,
            }),
          ]);

        if (!isMounted) {
          return;
        }

        const groups = Array.isArray(groupsResponse.data?.data)
          ? groupsResponse.data.data
          : [];
        const tasks = Array.isArray(tasksResponse.data?.data)
          ? tasksResponse.data.data
          : [];
        const members = Array.isArray(membersResponse.data?.data)
          ? membersResponse.data.data
          : [];

        setStatusGroupsState({ items: groups, loading: false, error: "" });
        setTasksState({ items: tasks, loading: false, error: "" });
        setMembersState({ items: members, loading: false, error: "" });
      } catch (error) {
        if (!isMounted || controller.signal.aborted) {
          return;
        }
        const message =
          error?.response?.data?.message ||
          "Самбарын дэлгэрэнгүй татахад алдаа гарлаа.";
        setStatusGroupsState({ items: [], loading: false, error: message });
        setTasksState({ items: [], loading: false, error: message });
        setMembersState({ items: [], loading: false, error: message });
      }
    };

    fetchBoardDetails();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [boardState.data?.id]);

  const memberLookup = useMemo(() => {
    const lookup = new Map();
    membersState.items.forEach((member) => {
      lookup.set(Number(member.id), member);
    });
    return lookup;
  }, [membersState.items]);

  const filteredTasks = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) {
      return tasksState.items;
    }
    return tasksState.items.filter((task) => {
      const title = task.title?.toLowerCase() ?? "";
      const description = task.description?.toLowerCase() ?? "";
      const statusGroup = task.status_group?.toLowerCase() ?? "";
      return (
        title.includes(normalized) ||
        description.includes(normalized) ||
        statusGroup.includes(normalized)
      );
    });
  }, [searchTerm, tasksState.items]);

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      const firstDate = parseDate(a.updated_at) || parseDate(a.created_at);
      const secondDate = parseDate(b.updated_at) || parseDate(b.created_at);
      if (!firstDate && !secondDate) {
        return 0;
      }
      if (!firstDate) {
        return 1;
      }
      if (!secondDate) {
        return -1;
      }
      return secondDate.getTime() - firstDate.getTime();
    });
  }, [filteredTasks]);

  const columns = useMemo(() => {
    const grouped = new Map();
    statusGroupsState.items.forEach((group) => {
      grouped.set(String(group.id), []);
    });

    sortedTasks.forEach((task) => {
      const key = task.status_group_id ? String(task.status_group_id) : "other";
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(task);
    });

    const structured = statusGroupsState.items.map((group) => ({
      id: String(group.id),
      name: group.name || "Тодорхойгүй",
      tasks: grouped.get(String(group.id)) ?? [],
    }));

    const unassigned = grouped.get("other") ?? [];
    if (unassigned.length > 0) {
      structured.push({ id: "other", name: "Бусад", tasks: unassigned });
    }

    return structured;
  }, [sortedTasks, statusGroupsState.items]);

  const metrics = useMemo(() => {
    const total = tasksState.items.length;
    let working = 0;
    let completed = 0;
    let stuck = 0;
    let overdue = 0;

    const now = new Date();

    tasksState.items.forEach((task) => {
      const statusKey = normalizeStatusKey(task.status);
      if (statusKey === "working" || statusKey === "pending") {
        working += 1;
      } else if (statusKey === "completed") {
        completed += 1;
      } else if (statusKey === "stuck") {
        stuck += 1;
      }

      const due = parseDate(task.planned_end_date || task.planned_start_date);
      if (due && due < now) {
        overdue += 1;
      }
    });

    return {
      total,
      working,
      completed,
      stuck,
      overdue,
    };
  }, [tasksState.items]);

  const isLoading =
    boardState.loading ||
    statusGroupsState.loading ||
    tasksState.loading ||
    membersState.loading;

  const combinedError =
    boardState.error ||
    statusGroupsState.error ||
    tasksState.error ||
    membersState.error;

  const handleSearchChange = useCallback((event) => {
    setSearchTerm(event.target.value);
  }, []);

  const openStatusModal = useCallback(() => {
    setStatusForm({ name: "" });
    setStatusError("");
    setIsStatusModalOpen(true);
  }, []);

  const closeStatusModal = useCallback(() => {
    if (statusSaving) {
      return;
    }
    setIsStatusModalOpen(false);
    setStatusForm({ name: "" });
    setStatusError("");
  }, [statusSaving]);

  const handleStatusInputChange = useCallback(
    (event) => {
      const { name, value } = event.target;
      setStatusForm((prev) => ({ ...prev, [name]: value }));
      if (statusError) {
        setStatusError("");
      }
    },
    [statusError]
  );

  const submitStatusForm = useCallback(
    async (event) => {
      event.preventDefault();
      if (!boardState.data?.id || statusSaving) {
        return;
      }
      const trimmedName = statusForm.name.trim();
      if (!trimmedName) {
        setStatusError("Баганы нэр оруулна уу.");
        return;
      }
      setStatusSaving(true);
      setStatusError("");
      try {
        const payload = {
          name: trimmedName,
          position: statusGroupsState.items.length,
        };
        const response = await apiClient.post(
          `/boards/${boardState.data.id}/status-groups`,
          payload
        );
        const created = response.data?.statusGroup;
        if (created) {
          setStatusGroupsState((prev) => ({
            ...prev,
            items: [...prev.items, created].sort((a, b) => {
              const first = Number(a.position) || 0;
              const second = Number(b.position) || 0;
              return first - second;
            }),
          }));
        }
        closeStatusModal();
      } catch (error) {
        const message =
          error?.response?.data?.message || "Багана нэмэх явцад алдаа гарлаа.";
        setStatusError(message);
      } finally {
        setStatusSaving(false);
      }
    },
    [
      boardState.data?.id,
      closeStatusModal,
      statusForm.name,
      statusGroupsState.items,
      statusSaving,
    ]
  );

  const openCreateTaskModal = useCallback(() => {
    setTaskModalState({ isOpen: true, mode: "create", task: null });
  }, []);

  const openEditTaskModal = useCallback((task) => {
    if (!task) {
      return;
    }
    setTaskModalState({ isOpen: true, mode: "edit", task });
  }, []);

  const closeTaskModal = useCallback(() => {
    setTaskModalState({ isOpen: false, mode: "create", task: null });
  }, []);

  const handleCreateTask = useCallback(
    async (payload) => {
      try {
        const response = await apiClient.post("/tasks", payload);
        const created = response.data?.task;
        if (created) {
          setTasksState((prev) => ({
            ...prev,
            items: [created, ...prev.items],
            error: "",
          }));
        }
        return created;
      } catch (error) {
        const message =
          error?.response?.data?.message || "Ажил нэмэх явцад алдаа гарлаа.";
        setTasksState((prev) => ({
          ...prev,
          error: message,
        }));
        throw error;
      }
    },
    [setTasksState]
  );

  const handleUpdateTask = useCallback(
    async (taskId, payload) => {
      try {
        const response = await apiClient.patch(`/tasks/${taskId}`, payload);
        const updated = response.data?.task;
        if (updated) {
          setTasksState((prev) => ({
            ...prev,
            items: prev.items.map((item) =>
              item.id === taskId ? updated : item
            ),
            error: "",
          }));
        }
        return updated;
      } catch (error) {
        const message =
          error?.response?.data?.message || "Ажил засах явцад алдаа гарлаа.";
        setTasksState((prev) => ({
          ...prev,
          error: message,
        }));
        throw error;
      }
    },
    [setTasksState]
  );

  const handleDeleteTask = useCallback(
    async (task) => {
      if (!task?.id || deletingTaskId) {
        return;
      }
      const confirmed = window.confirm("Энэ ажлыг устгах уу?");
      if (!confirmed) {
        return;
      }
      setDeletingTaskId(task.id);
      try {
        await apiClient.delete(`/tasks/${task.id}`);
        setTasksState((prev) => ({
          ...prev,
          items: prev.items.filter((item) => item.id !== task.id),
          error: "",
        }));
      } catch (error) {
        const message =
          error?.response?.data?.message || "Ажил устгах явцад алдаа гарлаа.";
        setTasksState((prev) => ({
          ...prev,
          error: message,
        }));
      } finally {
        setDeletingTaskId(null);
      }
    },
    [deletingTaskId, setTasksState]
  );

  const moveTaskToColumn = useCallback(
    async (taskId, targetColumnId) => {
      const task = tasksState.items.find((item) => item.id === taskId);
      if (!task) {
        return;
      }
      const nextGroupId = targetColumnId === "other" ? null : targetColumnId;
      if (String(task.status_group_id || "") === String(nextGroupId || "")) {
        return;
      }

      const targetGroup = statusGroupsState.items.find(
        (group) => String(group.id) === String(targetColumnId)
      );

      // Optimistic UI update for smoother drag/drop.
      setTasksState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === taskId
            ? {
                ...item,
                status_group_id: nextGroupId,
                status_group: targetGroup?.name || "",
              }
            : item
        ),
      }));

      try {
        await apiClient.patch(`/tasks/${taskId}`, {
          statusGroupId: nextGroupId,
        });
      } catch (error) {
        const message =
          error?.response?.data?.message || "Даалгаврыг зөөхөд алдаа гарлаа.";
        setTasksState((prev) => ({
          ...prev,
          error: message,
        }));
        // Revert on failure.
        setTasksState((prev) => ({
          ...prev,
          items: prev.items.map((item) =>
            item.id === taskId
              ? { ...item, status_group_id: task.status_group_id }
              : item
          ),
        }));
      }
    },
    [statusGroupsState.items, tasksState.items]
  );

  const renderTaskCard = useCallback(
    (task) => {
      const statusKey = normalizeStatusKey(task.status);
      const palette = statusPalette[statusKey] ?? statusPalette.unknown;
      const assignees = Array.isArray(task.assignees)
        ? task.assignees
            .map((assigneeId) => memberLookup.get(Number(assigneeId)))
            .filter(Boolean)
        : [];
      const due = parseDate(
        task.planned_end_date || task.planned_start_date || null
      );
      const overdue = due ? due.getTime() < Date.now() : false;

      return (
        <article
          key={task.id}
          draggable
          onDragStart={() => setDraggedTaskId(task.id)}
          onDragEnd={() => setDraggedTaskId(null)}
          className="flex min-h-[190px] cursor-grab flex-col gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-[#9AA0A6] line-clamp-1 break-words">
                {task.task_group || task.status_group || ""}
              </p>
              <h3 className="mt-1 text-base font-semibold text-[#111827] leading-snug line-clamp-2 break-words">
                {task.title || "Нэргүй ажил"}
              </h3>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span
                className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${palette.chip}`}
              >
                <span className={`h-2 w-2 rounded-full ${palette.dot}`} />
                {palette.label}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditTaskModal(task)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                >
                  Засах
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTask(task)}
                  className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
                  disabled={deletingTaskId === task.id}
                >
                  {deletingTaskId === task.id ? "Устгаж..." : "Устгах"}
                </button>
              </div>
            </div>
          </div>
          {task.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-[#4B5563] wrap-break-words">
              {task.description}
            </p>
          ) : null}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 text-xs text-[#6F767E]">
            <div className="flex items-center gap-2 rounded-full bg-[#F3F4F6] px-3 py-1">
              <span className="font-semibold text-[#4B5563]">Дуусах</span>
              <span className={overdue ? "text-rose-600" : "text-[#111827]"}>
                {due ? dueDateFormatter.format(due) : "Товлогдоогүй"}
              </span>
            </div>
            <div className="flex -space-x-2">
              {assignees.length === 0 ? (
                <span className="rounded-full border border-[#E2E8F0] bg-white px-2 py-1 text-[11px] text-[#6F767E]">
                  Гишүүнгүй
                </span>
              ) : (
                assignees.slice(0, 3).map((member) => (
                  <span
                    key={member.id}
                    title={buildMemberName(member)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white bg-[#111827] text-xs font-semibold text-white shadow-sm"
                  >
                    {buildMemberInitials(member)}
                  </span>
                ))
              )}
              {assignees.length > 3 ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white bg-[#E5E7EB] text-xs font-semibold text-[#111827]">
                  +{assignees.length - 3}
                </span>
              ) : null}
            </div>
          </div>
        </article>
      );
    },
    [deletingTaskId, handleDeleteTask, memberLookup, openEditTaskModal]
  );

  return (
    <section className="min-h-full  px-6 pb-12 pt-6">
      <div className=" max-w-full">
        <div className="rounded-[30px] bg-white px-6 pb-10 pt-8 shadow-lg">
          {boardState.loading ? (
            <p className="text-sm text-[#6F767E]">Түр хүлээнэ үү...</p>
          ) : null}
          {combinedError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {combinedError}
            </div>
          ) : null}
          {!boardState.loading && !combinedError && !boardState.data ? (
            <div className="space-y-6">
              <p className="text-lg font-semibold text-[#111827]">
                Самбар олдсонгүй.
              </p>
              <Link
                to="/tasks/boards"
                className="inline-flex items-center gap-2 rounded-full border border-[#D1D5DB] px-4 py-2 text-sm font-medium text-[#111827] hover:bg-[#F3F4F6]"
              >
                Самбарууд руу буцах
              </Link>
            </div>
          ) : null}

          {boardState.data ? (
            <div className="space-y-10">
              <header className="flex flex-wrap items-start justify-between gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm text-[#6F767E]">
                    <Link
                      to="/tasks/boards"
                      className="inline-flex items-center gap-2 text-[#6F767E] hover:text-[#111827]"
                    >
                      <span className="text-lg">←</span>
                      Самбарууд
                    </Link>
                    <span className="text-[#D1D5DB]">/</span>
                    <span className="font-medium text-[#111827]">
                      {boardState.data.name || "Нэргүй самбар"}
                    </span>
                  </div>
                  <div>
                    <h1 className="text-3xl font-semibold text-[#111827]">
                      {boardState.data.name || "Нэргүй самбар"}
                    </h1>
                    {boardState.data.description ? (
                      <p className="mt-3 max-w-3xl text-sm text-[#4B5563]">
                        {boardState.data.description}
                      </p>
                    ) : null}
                  </div>
                  <dl className="flex flex-wrap gap-4 text-sm text-[#6F767E]">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#111827]">
                        Workspace:
                      </span>
                      <span>
                        {workspaceState.loading
                          ? "Ачааллаж байна..."
                          : workspaceState.name || "Тодорхойгүй"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#111827]">
                        Гишүүд:
                      </span>
                      <span>
                        {membersState.loading
                          ? "Ачааллаж байна..."
                          : boardState.data.member_count ??
                            membersState.items.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#111827]">
                        {formatBoardMeta(boardState.data)}
                      </span>
                    </div>
                  </dl>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="rounded-full border border-[#D1D5DB] px-5 py-2 text-sm font-medium text-[#111827] transition-colors hover:bg-[#F3F4F6]"
                    onClick={openStatusModal}
                    disabled={statusGroupsState.loading || statusSaving}
                  >
                    Шинэ багана
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-[#111827] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0B0F19]"
                    onClick={openCreateTaskModal}
                    disabled={tasksState.loading || !boardState.data}
                  >
                    Шинэ ажил
                  </button>
                </div>
              </header>

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  accent="bg-[#111827]"
                  label="Нийт ажил"
                  value={metrics.total}
                  caption="Энэ самбарт бүртгэгдсэн ажлууд"
                />
                <MetricCard
                  accent="bg-[#0EA5E9]"
                  label="Явагдаж буй"
                  value={metrics.working}
                  caption="Идэвхтэй хянагдаж буй ажлууд"
                />
                <MetricCard
                  accent="bg-[#10B981]"
                  label="Дууссан"
                  value={metrics.completed}
                  caption="Амжилттай хаагдсан ажлууд"
                />
                <MetricCard
                  accent="bg-[#F97316]"
                  label="Хугацаа хэтэрсэн"
                  value={metrics.overdue}
                  caption="Төлөвлөсөн хугацаанаас хэтэрсэн"
                />
              </section>

              <section className="flex flex-wrap items-center justify-between gap-4">
                <Searchbar
                  placeholder="Ажил"
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
                <div className="flex items-center gap-4 text-sm text-[#6F767E]">
                  <span>Хайлттай тохирох: {sortedTasks.length} ажил</span>
                  <span>Нийт: {tasksState.items.length} ажил</span>
                </div>
              </section>

              <div className="flex  overflow-hidden pb-2">
                <div className="flex flex-wrap min-h-105 gap-5">
                  {isLoading ? (
                    <div className="flex h-full w-full items-center justify-center text-sm text-[#6F767E]">
                      Ачааллаж байна...
                    </div>
                  ) : null}

                  {!isLoading && columns.length === 0 ? (
                    <div className="flex w-full flex-col items-center justify-center rounded-3xl border border-dashed border-[#D5D9E0] bg-[#FAFBFF] p-12 text-center text-sm text-[#6F767E]">
                      Энэ самбарт хараахан ажил нэмэгдээгүй байна.
                    </div>
                  ) : null}

                  {!isLoading
                    ? columns.map((column) => {
                        const isActive = activeDropColumn === column.id;
                        return (
                          <div
                            key={column.id}
                            onDragOver={(event) => {
                              event.preventDefault();
                              setActiveDropColumn(column.id);
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              if (draggedTaskId) {
                                moveTaskToColumn(draggedTaskId, column.id);
                              }
                              setActiveDropColumn(null);
                            }}
                            onDragLeave={() => setActiveDropColumn(null)}
                            className={`flex min-w-[320px] flex-1 flex-col rounded-3xl border bg-[#F8FAFC] p-4 transition ${
                              isActive
                                ? "border-[#111827]/30 bg-white shadow-md"
                                : "border-[#ECEEF3]"
                            }`}
                          >
                            <header className="flex items-center justify-between gap-2">
                              <h2 className="text-sm font-semibold text-[#111827] line-clamp-1 break-words">
                                {column.name}
                              </h2>
                              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#6F767E]">
                                {column.tasks.length}
                              </span>
                            </header>
                            <div className="mt-4 flex-1 space-y-4">
                              {column.tasks.length === 0 ? (
                                <EmptyColumnState description="Ажил нэмээгүй байна." />
                              ) : (
                                column.tasks.map((task) => renderTaskCard(task))
                              )}
                            </div>
                          </div>
                        );
                      })
                    : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {isStatusModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <header className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#111827]">
                  Шинэ багана
                </h2>
                <p className="mt-1 text-sm text-[#6F767E]">
                  Самбар дээр шинэ төлөв үүсгэнэ.
                </p>
              </div>
              <button
                type="button"
                onClick={closeStatusModal}
                className="rounded-full border border-[#E2E8F0] px-3 py-1 text-xs font-medium text-[#6F767E] hover:border-[#CBD5E1] hover:text-[#111827] disabled:opacity-60"
                disabled={statusSaving}
              >
                Хаах
              </button>
            </header>
            <form className="space-y-4" onSubmit={submitStatusForm}>
              <div>
                <label
                  htmlFor="status-name"
                  className="mb-1 block text-xs font-semibold text-[#111827]"
                >
                  Баганы нэр
                </label>
                <input
                  id="status-name"
                  name="name"
                  value={statusForm.name}
                  onChange={handleStatusInputChange}
                  autoFocus
                  placeholder="Жишээ: Working On It"
                  className="w-full rounded-2xl border border-[#E2E8F0] bg-white px-4 py-2 text-sm text-[#111827] shadow-sm focus:border-[#111827] focus:outline-none focus:ring-2 focus:ring-[#111827]/10"
                  disabled={statusSaving}
                />
              </div>
              {statusError ? (
                <p className="text-xs text-rose-600">{statusError}</p>
              ) : null}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeStatusModal}
                  className="rounded-full border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#6F767E] hover:border-[#CBD5E1] hover:text-[#111827] disabled:opacity-60"
                  disabled={statusSaving}
                >
                  Цуцлах
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-[#111827] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B0F19] disabled:opacity-60"
                  disabled={statusSaving}
                >
                  {statusSaving ? "Хадгалж байна..." : "Хадгалах"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      <TaskModal
        isOpen={taskModalState.isOpen}
        mode={taskModalState.mode}
        task={taskModalState.task}
        onClose={closeTaskModal}
        board={boardState.data}
        statusGroups={statusGroupsState.items}
        members={membersState.items}
        onCreate={handleCreateTask}
        onUpdate={handleUpdateTask}
      />
    </section>
  );
}

export default Board;
