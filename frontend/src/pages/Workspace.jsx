import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../utils/apiClient";
import SearchIcon from "../assets/icons8-search.svg";
import Loader from "../components/loader.jsx";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const formatDate = (value) => {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return dateFormatter.format(parsed);
};

const buildCreatorName = (board) => {
  const first = board.creator_first_name?.trim();
  const last = board.creator_last_name?.trim();
  const fullName = [first, last].filter(Boolean).join(" ");
  if (fullName) {
    return fullName;
  }
  const email = board.creator_email?.trim();
  if (email) {
    return email;
  }
  return "Тодорхойгүй";
};

const buildCreatorInitials = (board) => {
  const first = board.creator_first_name?.trim();
  const last = board.creator_last_name?.trim();
  const firstInitial = first ? first[0].toUpperCase() : "";
  const lastInitial = last ? last[0].toUpperCase() : "";
  const combined = `${firstInitial}${lastInitial}`.trim();
  if (combined) {
    return combined;
  }
  if (firstInitial) {
    return firstInitial;
  }
  if (lastInitial) {
    return lastInitial;
  }
  const email = board.creator_email?.trim();
  if (email) {
    return email[0].toUpperCase();
  }
  return "?";
};

const MS_IN_DAY = 24 * 60 * 60 * 1000;

const parseDateValue = (value) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const isWithinDays = (value, days) => {
  const parsed = parseDateValue(value);
  if (!parsed) {
    return false;
  }
  const threshold = Date.now() - days * MS_IN_DAY;
  return parsed.getTime() >= threshold;
};

const FILTER_OPTIONS = [
  {
    id: "all",
    label: "All boards",
    description: "Бүх самбар харагдана.",
    predicate: () => true,
  },
  {
    id: "createdLast30",
    label: "Created last 30 days",
    description: "Сүүлийн 30 хоногт нэмсэн самбарууд.",
    predicate: (board) => isWithinDays(board.created_at, 30),
  },
  {
    id: "updatedLast7",
    label: "Updated last 7 days",
    description: "Сүүлийн 7 хоногт шинэчилсэн самбарууд.",
    predicate: (board) => isWithinDays(board.updated_at, 7),
  },
  {
    id: "hasMembers",
    label: "Has members",
    description: "Гишүүнтэй самбарууд.",
    predicate: (board) => Number(board.member_count ?? 0) > 0,
  },
];

function Workspace() {
  const [workspacesState, setWorkspacesState] = useState({
    items: [],
    loading: true,
    error: "",
  });
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return window.sessionStorage.getItem("selectedWorkspaceId");
  });
  const [boardsState, setBoardsState] = useState({
    items: [],
    loading: false,
    error: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOption, setFilterOption] = useState("all");
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [deletingBoardId, setDeletingBoardId] = useState("");
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [workspaceForm, setWorkspaceForm] = useState({
    name: "",
    description: "",
  });
  const [workspaceSubmitting, setWorkspaceSubmitting] = useState(false);
  const [workspaceFormError, setWorkspaceFormError] = useState("");
  const [boardModal, setBoardModal] = useState({
    open: false,
    boardId: "",
    name: "",
    description: "",
  });
  const [boardSubmitting, setBoardSubmitting] = useState(false);
  const [boardFormError, setBoardFormError] = useState("");
  const filterButtonRef = useRef(null);
  const filterMenuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    const loadWorkspaces = async () => {
      setWorkspacesState((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const response = await apiClient.get("/workspaces", {
          params: { page: 1, pageSize: 50, sort: "updated_at" },
          signal: controller.signal,
        });
        const items = Array.isArray(response.data?.data)
          ? response.data.data
          : [];
        setWorkspacesState({ items, loading: false, error: "" });
        if (items.length === 0) {
          setSelectedWorkspaceId(null);
          return;
        }

        const storedId =
          typeof window !== "undefined"
            ? window.sessionStorage.getItem("selectedWorkspaceId")
            : null;

        if (storedId && items.some((item) => String(item.id) === storedId)) {
          setSelectedWorkspaceId(storedId);
          return;
        }

        setSelectedWorkspaceId(String(items[0].id));
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setWorkspacesState((prev) => ({
          ...prev,
          loading: false,
          error:
            error.response?.data?.message || "Workspaces татахад алдаа гарлаа.",
        }));
      }
    };

    loadWorkspaces();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleWorkspaceSelection = (event) => {
      const nextValue =
        typeof event.detail === "string" && event.detail !== ""
          ? event.detail
          : null;
      setSelectedWorkspaceId((current) =>
        current === nextValue ? current : nextValue
      );
    };

    window.addEventListener("workspace:selected", handleWorkspaceSelection);
    return () => {
      window.removeEventListener(
        "workspace:selected",
        handleWorkspaceSelection
      );
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (selectedWorkspaceId) {
      window.sessionStorage.setItem("selectedWorkspaceId", selectedWorkspaceId);
    } else {
      window.sessionStorage.removeItem("selectedWorkspaceId");
    }
    window.dispatchEvent(
      new CustomEvent("workspace:selected", {
        detail: selectedWorkspaceId,
      })
    );
  }, [selectedWorkspaceId]);

  useEffect(() => {
    if (!selectedWorkspaceId) {
      setBoardsState({ items: [], loading: false, error: "" });
      return;
    }

    const controller = new AbortController();
    const loadBoards = async () => {
      setBoardsState((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const response = await apiClient.get("/boards", {
          params: { workspaceId: selectedWorkspaceId },
          signal: controller.signal,
        });
        const items = Array.isArray(response.data?.data)
          ? response.data.data
          : [];
        setBoardsState({ items, loading: false, error: "" });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setBoardsState((prev) => ({
          ...prev,
          loading: false,
          error:
            error.response?.data?.message || "Самбар татахад алдаа гарлаа.",
        }));
      }
    };

    loadBoards();

    return () => {
      controller.abort();
    };
  }, [selectedWorkspaceId]);

  useEffect(() => {
    if (!isFilterMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (
        filterButtonRef.current?.contains(event.target) ||
        filterMenuRef.current?.contains(event.target)
      ) {
        return;
      }
      setIsFilterMenuOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsFilterMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFilterMenuOpen]);

  const selectedWorkspace = useMemo(() => {
    if (!selectedWorkspaceId) {
      return null;
    }
    return (
      workspacesState.items.find(
        (item) => String(item.id) === selectedWorkspaceId
      ) ?? null
    );
  }, [workspacesState.items, selectedWorkspaceId]);

  const filteredBoards = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const activeFilter =
      FILTER_OPTIONS.find((option) => option.id === filterOption) ??
      FILTER_OPTIONS[0];

    return boardsState.items.filter((board) => {
      const matchesSearch = term
        ? board.name?.toLowerCase().includes(term)
        : true;
      if (!matchesSearch) {
        return false;
      }
      return activeFilter.predicate(board);
    });
  }, [boardsState.items, searchTerm, filterOption]);

  const workspaceInitial = (selectedWorkspace?.name ?? "?")
    .charAt(0)
    .toUpperCase();

  const activeFilter =
    FILTER_OPTIONS.find((option) => option.id === filterOption) ??
    FILTER_OPTIONS[0];

  const handleManageMembers = () => {
    if (!selectedWorkspaceId) {
      return;
    }
    navigate(`/employees?workspaceId=${selectedWorkspaceId}`);
  };

  const handleCreateWorkspace = () => {
    setWorkspaceForm({ name: "", description: "" });
    setWorkspaceFormError("");
    setWorkspaceModalOpen(true);
  };

  const handleEditBoard = (boardId) => {
    const targetBoard = boardsState.items.find(
      (item) => String(item.id) === String(boardId)
    );
    if (!targetBoard) {
      return;
    }
    setBoardFormError("");
    setBoardModal({
      open: true,
      boardId: String(targetBoard.id),
      name: targetBoard.name ?? "",
      description: targetBoard.description ?? "",
    });
  };

  const handleDeleteBoard = async (boardId) => {
    const numericId = Number(boardId);
    if (!Number.isFinite(numericId)) {
      return;
    }
    const shouldDelete = window.confirm("Самбарыг устгах уу?");
    if (!shouldDelete) {
      return;
    }

    setDeletingBoardId(String(boardId));
    try {
      await apiClient.delete(`/boards/${numericId}`);
      setBoardsState((prev) => ({
        ...prev,
        items: prev.items.filter((item) => String(item.id) !== String(boardId)),
        error: "",
      }));
    } catch (error) {
      setBoardsState((prev) => ({
        ...prev,
        error: error.response?.data?.message || "Самбар устгахад алдаа гарлаа.",
      }));
    } finally {
      setDeletingBoardId("");
    }
  };

  const closeWorkspaceModal = () => {
    if (workspaceSubmitting) {
      return;
    }
    setWorkspaceModalOpen(false);
  };

  const submitWorkspaceForm = async (event) => {
    event.preventDefault();
    const trimmedName = workspaceForm.name.trim();
    if (!trimmedName) {
      setWorkspaceFormError("Нэрийг заавал бөглөнө үү.");
      return;
    }

    setWorkspaceSubmitting(true);
    setWorkspaceFormError("");
    try {
      const response = await apiClient.post("/workspaces", {
        name: trimmedName,
        description: workspaceForm.description.trim() || null,
      });
      const newWorkspace = response.data?.workspace;
      if (!newWorkspace) {
        throw new Error("Invalid response");
      }
      setWorkspacesState((prev) => ({
        ...prev,
        items: [
          newWorkspace,
          ...prev.items.filter((item) => item.id !== newWorkspace.id),
        ],
        error: "",
      }));
      setWorkspaceModalOpen(false);
      setWorkspaceForm({ name: "", description: "" });
      setSelectedWorkspaceId(String(newWorkspace.id));
    } catch (error) {
      const message =
        error.response?.data?.message || "Workspace үүсгэхэд алдаа гарлаа.";
      setWorkspaceFormError(message);
    } finally {
      setWorkspaceSubmitting(false);
    }
  };

  const closeBoardModal = () => {
    if (boardSubmitting) {
      return;
    }
    setBoardModal((prev) => ({ ...prev, open: false }));
  };

  const submitBoardForm = async (event) => {
    event.preventDefault();
    if (!boardModal.boardId) {
      return;
    }
    const trimmedName = boardModal.name.trim();
    if (!trimmedName) {
      setBoardFormError("Самбарын нэрийг бөглөнө үү.");
      return;
    }

    setBoardSubmitting(true);
    setBoardFormError("");
    try {
      const response = await apiClient.patch(`/boards/${boardModal.boardId}`, {
        name: trimmedName,
        description: boardModal.description.trim(),
      });
      const updatedBoard = response.data?.board;
      if (!updatedBoard) {
        throw new Error("Invalid response");
      }
      setBoardsState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          String(item.id) === String(updatedBoard.id) ? updatedBoard : item
        ),
        error: "",
      }));
      setBoardModal({ open: false, boardId: "", name: "", description: "" });
    } catch (error) {
      const message =
        error.response?.data?.message || "Самбар засахад алдаа гарлаа.";
      setBoardFormError(message);
    } finally {
      setBoardSubmitting(false);
    }
  };

  const boardsContent = () => {
    if (boardsState.loading) {
      return (
        <tr>
          <td colSpan={6} className="py-6 text-center text-sm text-slate-500">
            <div className="flex flex-col items-center gap-2 py-1">
              <Loader size={48} />
              <span>Самбаруудыг татаж байна...</span>
            </div>
          </td>
        </tr>
      );
    }

    if (boardsState.error) {
      return (
        <tr>
          <td colSpan={6} className="py-6 text-center text-sm text-rose-500">
            {boardsState.error}
          </td>
        </tr>
      );
    }

    if (filteredBoards.length === 0) {
      return (
        <tr>
          <td colSpan={6} className="py-6 text-center text-sm text-slate-500">
            Самбар олдсонгүй.
          </td>
        </tr>
      );
    }

    return filteredBoards.map((board) => {
      const id = String(board.id);
      return (
        <tr
          key={id}
          className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50"
        >
          <td className="px-4 py-3 text-sm font-semibold text-slate-700">
            {board.name ?? "Unnamed board"}
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                {buildCreatorInitials(board)}
              </span>
              <div className="flex flex-col text-sm leading-tight">
                <span className="font-semibold text-slate-700">
                  {buildCreatorName(board)}
                </span>
                {board.creator_email ? (
                  <span className="text-xs text-slate-400">
                    {board.creator_email}
                  </span>
                ) : null}
              </div>
            </div>
          </td>
          <td className="px-4 py-3 text-sm text-slate-600">
            {formatDate(board.created_at)}
          </td>
          <td className="px-4 py-3 text-sm text-slate-600">
            {formatDate(board.updated_at)}
          </td>
          <td className="px-4 py-3 text-sm text-slate-500">—</td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleEditBoard(id)}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Засах
              </button>
              <button
                type="button"
                onClick={() => handleDeleteBoard(id)}
                disabled={deletingBoardId === id}
                className="rounded-lg border border-rose-300 px-3 py-1 text-sm font-semibold text-rose-600 transition hover:border-rose-400 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
              >
                {deletingBoardId === id ? "Устгаж байна..." : "Устгах"}
              </button>
            </div>
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="  px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-9xl min-h-full">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold text-slate-800">Workspaces</h1>
          <button
            type="button"
            onClick={handleCreateWorkspace}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Workspace нэмэх
          </button>
        </header>

        {workspacesState.loading ? (
          <div className="mt-10 flex flex-col items-center gap-3 rounded-3xl border border-slate-200 bg-white/70 p-10 text-center text-sm text-slate-500">
            <Loader size={72} />
            <span>Workspace мэдээллийг татаж байна...</span>
          </div>
        ) : workspacesState.error ? (
          <div className="mt-10 rounded-3xl border border-rose-200 bg-rose-50 p-10 text-center text-sm text-rose-600">
            {workspacesState.error}
          </div>
        ) : !selectedWorkspace ? (
          <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            Workspace сонгогдоогүй байна.
          </div>
        ) : (
          <section className="mt-10 rounded-[30px] bg-white shadow-lg">
            <div className="relative">
              <div className="h-80 w-full overflow-hidden rounded-t-[30px] ">
                <div className="h-full w-full bg-linear-to-br from-blue-400 to-blue-600 bg-cover bg-center opacity-80" />
              </div>
              <div className="absolute left-8 bottom-[-55px] flex h-25 w-25 items-center justify-center rounded-3xl bg-rose-600 text-5xl font-bold text-white shadow-lg">
                {workspaceInitial}
              </div>
              <div className="max-w-2xl absolute left-35 bottom-[-55px]">
                <h2 className="text-2xl font-semibold text-slate-900">
                  {selectedWorkspace.name}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {selectedWorkspace.description || "Тайлбар байхгүй"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleManageMembers}
                className="absolute right-6 top-6 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                aria-label="Manage workspace members"
              >
                Гишүүд
              </button>
            </div>
            <div className="px-8 pt-16 pb-8">
              <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full md:max-w-md">
                  <img
                    src={SearchIcon}
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 opacity-60"
                  />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Самбар хайх..."
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </div>
                <div className="relative inline-flex">
                  <button
                    type="button"
                    ref={filterButtonRef}
                    onClick={() => setIsFilterMenuOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
                    aria-haspopup="menu"
                    aria-expanded={isFilterMenuOpen}
                  >
                    <span>Шүүлтүүр</span>
                    {activeFilter.id !== "all" ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                        {activeFilter.label}
                      </span>
                    ) : null}
                    <span className="ml-1 text-slate-400">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className={`h-4 w-4 transition-transform ${
                          isFilterMenuOpen ? "rotate-180" : ""
                        }`}
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.25a.75.75 0 0 1-1.06 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                  </button>
                  {isFilterMenuOpen ? (
                    <div
                      ref={filterMenuRef}
                      className="absolute right-0 top-[calc(100%+8px)] z-10 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_20px_40px_rgba(15,23,42,0.12)]"
                      role="menu"
                    >
                      <div className="flex flex-col gap-1">
                        {FILTER_OPTIONS.map((option) => {
                          const isActive = option.id === filterOption;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => {
                                setFilterOption(option.id);
                                setIsFilterMenuOpen(false);
                              }}
                              className={`flex w-full flex-col rounded-xl px-3 py-2 text-left transition hover:bg-slate-50 ${
                                isActive
                                  ? "bg-slate-100 text-slate-800"
                                  : "text-slate-600"
                              }`}
                              role="menuitemradio"
                              aria-checked={isActive}
                            >
                              <span className="flex items-center justify-between text-sm font-semibold">
                                {option.label}
                                {isActive ? (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 20 20"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    className="h-4 w-4"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="m5 10 3 3 7-7"
                                    />
                                  </svg>
                                ) : null}
                              </span>
                              <span className="mt-1 text-xs text-slate-500">
                                {option.description}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                <table className="min-w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Гарчиг</th>
                      <th className="px-4 py-3">Үүсгэсэн ажилтан</th>
                      <th className="px-4 py-3">Үүсгэсэн огноо</th>
                      <th className="px-4 py-3">Сүүлд өөрчилсөн</th>
                      <th className="px-4 py-3">Файл</th>
                      <th className="px-4 py-3">Үйлдэл</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">{boardsContent()}</tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>
      {workspaceModalOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">
                Workspace нэмэх
              </h2>
              <button
                type="button"
                onClick={closeWorkspaceModal}
                className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Цонх хаах"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 8.94 5.53 4.47a.75.75 0 0 0-1.06 1.06L8.94 10l-4.47 4.47a.75.75 0 1 0 1.06 1.06L10 11.06l4.47 4.47a.75.75 0 0 0 1.06-1.06L11.06 10l4.47-4.47a.75.75 0 0 0-1.06-1.06L10 8.94Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            <form
              className="mt-6 flex flex-col gap-4"
              onSubmit={submitWorkspaceForm}
            >
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Нэр
                <input
                  type="text"
                  value={workspaceForm.name}
                  onChange={(event) =>
                    setWorkspaceForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Workspace нэр"
                  required
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Тайлбар (сонголттой)
                <textarea
                  value={workspaceForm.description}
                  onChange={(event) =>
                    setWorkspaceForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  className="min-h-30 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Тайлбар оруулах"
                />
              </label>
              {workspaceFormError ? (
                <p className="text-sm text-rose-500">{workspaceFormError}</p>
              ) : null}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeWorkspaceModal}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
                  disabled={workspaceSubmitting}
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={workspaceSubmitting}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {workspaceSubmitting ? "Хадгалж байна..." : "Хадгалах"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {boardModal.open ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">
                Самбар засах
              </h2>
              <button
                type="button"
                onClick={closeBoardModal}
                className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Цонх хаах"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 8.94 5.53 4.47a.75.75 0 0 0-1.06 1.06L8.94 10l-4.47 4.47a.75.75 0 1 0 1.06 1.06L10 11.06l4.47 4.47a.75.75 0 0 0 1.06-1.06L11.06 10l4.47-4.47a.75.75 0 0 0-1.06-1.06L10 8.94Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            <form
              className="mt-6 flex flex-col gap-4"
              onSubmit={submitBoardForm}
            >
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Нэр
                <input
                  type="text"
                  value={boardModal.name}
                  onChange={(event) =>
                    setBoardModal((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Самбарын нэр"
                  required
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Тайлбар (сонголттой)
                <textarea
                  value={boardModal.description}
                  onChange={(event) =>
                    setBoardModal((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  className="min-h-30 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Тайлбар оруулах"
                />
              </label>
              {boardFormError ? (
                <p className="text-sm text-rose-500">{boardFormError}</p>
              ) : null}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeBoardModal}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
                  disabled={boardSubmitting}
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={boardSubmitting}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {boardSubmitting ? "Хадгалж байна..." : "Хадгалах"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Workspace;
