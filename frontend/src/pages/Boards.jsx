import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import apiClient from "../utils/apiClient";
import SearchIcon from "../assets/icons8-search.svg";
import Searchbar from "../components/Searchbar.jsx";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const formatDate = (value) => {
  if (!value) {
    return "—";
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return dateFormatter.format(parsed);
};

const buildCreatorName = (board) => {
  const first = board?.creator_first_name?.trim();
  const last = board?.creator_last_name?.trim();
  const fullName = [first, last].filter(Boolean).join(" ");
  if (fullName) {
    return fullName;
  }
  const email = board?.creator_email?.trim();
  return email || "Тодорхойгүй";
};

const buildCreatorInitials = (board) => {
  const first = board?.creator_first_name?.trim();
  const last = board?.creator_last_name?.trim();
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
  const email = board?.creator_email?.trim();
  if (email) {
    return email[0]?.toUpperCase() ?? "?";
  }
  return "?";
};

const formatEmployeeName = (employee) => {
  const first = employee?.first_name?.trim();
  const last = employee?.last_name?.trim();
  const full = [first, last].filter(Boolean).join(" ");
  if (full) {
    return full;
  }
  return employee?.email || "Тодорхойгүй";
};

const compareEmployeesByName = (a, b) =>
  formatEmployeeName(a).localeCompare(formatEmployeeName(b), undefined, {
    sensitivity: "base",
  });

const adjustMemberCount = (value, delta) => {
  const numeric = Number(value);
  const base = Number.isFinite(numeric) ? numeric : 0;
  const next = base + delta;
  return next < 0 ? 0 : next;
};

function Boards() {
  const navigate = useNavigate();
  const [boardsState, setBoardsState] = useState({
    items: [],
    loading: true,
    error: "",
  });
  const [workspacesState, setWorkspacesState] = useState({
    items: [],
    loading: true,
    error: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [editingBoard, setEditingBoard] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", description: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [createForm, setCreateForm] = useState({
    workspaceId: "",
    name: "",
    description: "",
  });
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createMembers, setCreateMembers] = useState([]);
  const [createSelectedMemberId, setCreateSelectedMemberId] = useState("");
  const [createMemberError, setCreateMemberError] = useState("");
  const [employeesState, setEmployeesState] = useState({
    items: [],
    loading: false,
    error: "",
  });
  const [boardMembersState, setBoardMembersState] = useState({
    items: [],
    loading: false,
    error: "",
  });
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [memberActionPending, setMemberActionPending] = useState(false);
  const [memberActionError, setMemberActionError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadWorkspaces = async () => {
      setWorkspacesState((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const response = await apiClient.get("/workspaces", {
          params: { page: 1, pageSize: 100, sort: "updated_at" },
          signal: controller.signal,
        });
        if (!isActive) {
          return;
        }
        const items = Array.isArray(response.data?.data)
          ? response.data.data
          : [];
        setWorkspacesState({ items, loading: false, error: "" });
      } catch (error) {
        if (!isActive || controller.signal.aborted) {
          return;
        }
        setWorkspacesState((prev) => ({
          ...prev,
          loading: false,
          error:
            error.response?.data?.message ||
            "Workspace мэдээллийг татахад алдаа гарлаа.",
        }));
      }
    };

    loadWorkspaces();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadBoards = async () => {
      setBoardsState((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const response = await apiClient.get("/boards", {
          signal: controller.signal,
        });
        if (!isActive) {
          return;
        }
        const items = Array.isArray(response.data?.data)
          ? response.data.data
          : [];
        setBoardsState({ items, loading: false, error: "" });
      } catch (error) {
        if (!isActive || controller.signal.aborted) {
          return;
        }
        setBoardsState((prev) => ({
          ...prev,
          loading: false,
          error:
            error.response?.data?.message ||
            "Самбарын мэдээлэл татахад алдаа гарлаа.",
        }));
      }
    };

    loadBoards();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!editingBoard && !creatingBoard) {
      return;
    }
    if (employeesState.items.length) {
      return;
    }

    const controller = new AbortController();
    let isActive = true;

    const loadEmployees = async () => {
      setEmployeesState((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const response = await apiClient.get("/employees", {
          params: { page: 1, pageSize: 500, sort: "first_name" },
          signal: controller.signal,
        });
        if (!isActive) {
          return;
        }
        const items = Array.isArray(response.data?.data)
          ? response.data.data
          : [];
        setEmployeesState({ items, loading: false, error: "" });
      } catch (error) {
        if (!isActive || controller.signal.aborted) {
          return;
        }
        setEmployeesState((prev) => ({
          ...prev,
          loading: false,
          error:
            error.response?.data?.message ||
            "Ажилчдын мэдээлэл татахад алдаа гарлаа.",
        }));
      }
    };

    loadEmployees();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [editingBoard, creatingBoard, employeesState.items.length]);

  useEffect(() => {
    if (!editingBoard) {
      return;
    }

    const controller = new AbortController();
    let isActive = true;

    setBoardMembersState({ items: [], loading: true, error: "" });

    const loadMembers = async () => {
      try {
        const response = await apiClient.get(
          `/boards/${editingBoard.id}/members`,
          { signal: controller.signal }
        );
        if (!isActive) {
          return;
        }
        const items = Array.isArray(response.data?.data)
          ? response.data.data
          : [];
        const sortedItems = [...items].sort(compareEmployeesByName);
        setBoardMembersState({
          items: sortedItems,
          loading: false,
          error: "",
        });
      } catch (error) {
        if (!isActive || controller.signal.aborted) {
          return;
        }
        setBoardMembersState({
          items: [],
          loading: false,
          error:
            error.response?.data?.message ||
            "Самбарын гишүүдийг татахад алдаа гарлаа.",
        });
      }
    };

    loadMembers();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [editingBoard?.id]);

  const workspaceLookup = useMemo(() => {
    const lookup = {};
    workspacesState.items.forEach((item) => {
      lookup[String(item.id)] = item.name;
    });
    return lookup;
  }, [workspacesState.items]);

  const filteredBoards = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return boardsState.items;
    }
    return boardsState.items.filter((board) => {
      const name = board.name?.toLowerCase() ?? "";
      const description = board.description?.toLowerCase() ?? "";
      const workspaceName =
        workspaceLookup[String(board.workspace_id)]?.toLowerCase() ?? "";
      return (
        name.includes(term) ||
        description.includes(term) ||
        workspaceName.includes(term)
      );
    });
  }, [boardsState.items, searchTerm, workspaceLookup]);

  const availableEmployees = useMemo(
    () =>
      employeesState.items
        .filter(
          (employee) =>
            !boardMembersState.items.some(
              (member) => String(member.id) === String(employee.id)
            )
        )
        .sort(compareEmployeesByName),
    [employeesState.items, boardMembersState.items]
  );

  const availableEmployeeOptions = useMemo(
    () =>
      availableEmployees.map((employee) => ({
        value: String(employee.id),
        label: formatEmployeeName(employee),
        meta: [employee.email, employee.position_title]
          .filter(Boolean)
          .join(" · "),
      })),
    [availableEmployees]
  );

  const availableEmployeesForCreate = useMemo(
    () =>
      employeesState.items
        .filter(
          (employee) =>
            !createMembers.some(
              (member) => String(member.id) === String(employee.id)
            )
        )
        .sort(compareEmployeesByName),
    [employeesState.items, createMembers]
  );

  const availableEmployeeOptionsForCreate = useMemo(
    () =>
      availableEmployeesForCreate.map((employee) => ({
        value: String(employee.id),
        label: formatEmployeeName(employee),
        meta: [employee.email, employee.position_title]
          .filter(Boolean)
          .join(" · "),
      })),
    [availableEmployeesForCreate]
  );

  const totalMembers = useMemo(
    () =>
      boardsState.items.reduce(
        (total, board) => total + (Number(board.member_count) || 0),
        0
      ),
    [boardsState.items]
  );

  const latestUpdatedAt = useMemo(() => {
    const timestamps = boardsState.items
      .map((board) => {
        const parsed = Date.parse(board.updated_at ?? "");
        return Number.isFinite(parsed) ? parsed : null;
      })
      .filter((value) => value !== null);
    if (!timestamps.length) {
      return null;
    }
    return new Date(Math.max(...timestamps));
  }, [boardsState.items]);

  const openCreateBoardModal = () => {
    const firstWorkspaceId =
      workspacesState.items.length > 0
        ? String(workspacesState.items[0].id)
        : "";
    setCreateForm({ workspaceId: firstWorkspaceId, name: "", description: "" });
    setCreateError("");
    setCreateMembers([]);
    setCreateSelectedMemberId("");
    setCreateMemberError("");
    setCreatingBoard(true);
  };

  const closeCreateBoardModal = (force = false) => {
    if (createSaving && !force) {
      return;
    }
    setCreatingBoard(false);
    setCreateForm({ workspaceId: "", name: "", description: "" });
    setCreateError("");
    setCreateMembers([]);
    setCreateSelectedMemberId("");
    setCreateMemberError("");
  };

  const handleCreateInputChange = (event) => {
    const { name, value } = event.target;
    setCreateForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateMemberSelectChange = (nextValue) => {
    setCreateSelectedMemberId(String(nextValue || ""));
    if (createMemberError) {
      setCreateMemberError("");
    }
  };

  const handleAddMemberToCreate = () => {
    if (!createSelectedMemberId) {
      setCreateMemberError("Нэмж оруулах ажилтнаа сонгоно уу.");
      return;
    }
    const alreadySelected = createMembers.some(
      (member) => String(member.id) === String(createSelectedMemberId)
    );
    if (alreadySelected) {
      setCreateMemberError("Энэ гишүүн аль хэдийн нэмэгдсэн байна.");
      return;
    }
    const employee = employeesState.items.find(
      (item) => String(item.id) === String(createSelectedMemberId)
    );
    if (!employee) {
      setCreateMemberError("Сонгосон ажилтан олдсонгүй.");
      return;
    }
    setCreateMembers((prev) =>
      [...prev, employee].sort(compareEmployeesByName)
    );
    setCreateSelectedMemberId("");
    setCreateMemberError("");
  };

  const handleRemoveMemberFromCreate = (memberId) => {
    setCreateMembers((prev) =>
      prev
        .filter((member) => String(member.id) !== String(memberId))
        .sort(compareEmployeesByName)
    );
  };

  const handleSubmitCreate = async (event) => {
    event.preventDefault();
    const name = createForm.name.trim();
    const description = createForm.description.trim();
    const workspaceIdValue = createForm.workspaceId.trim();
    if (!workspaceIdValue) {
      setCreateError("Workspace сонгоно уу.");
      return;
    }
    if (!name) {
      setCreateError("Нэр заавал хэрэгтэй.");
      return;
    }
    const payload = {
      workspaceId: workspaceIdValue,
      name,
      description: description || null,
    };
    setCreateSaving(true);
    setCreateError("");
    try {
      const response = await apiClient.post("/boards", payload);
      const createdBoard = response.data?.board;

      if (createdBoard) {
        let successfulAdds = 0;
        const failedMembers = [];

        for (const member of createMembers) {
          try {
            await apiClient.post(`/boards/${createdBoard.id}/members`, {
              employeeId: member.id,
            });
            successfulAdds += 1;
          } catch (memberError) {
            failedMembers.push(member);
            console.error(memberError);
          }
        }

        const updatedBoard = {
          ...createdBoard,
          member_count: adjustMemberCount(
            createdBoard.member_count,
            successfulAdds
          ),
        };

        setBoardsState((prev) => ({
          ...prev,
          items: [updatedBoard, ...prev.items],
        }));

        if (failedMembers.length) {
          const failedNames = failedMembers
            .map((member) => formatEmployeeName(member))
            .join(", ");
          window.alert(
            `Самбар үүссэн. Гэвч дараах гишүүдийг нэмэхэд алдаа гарлаа: ${failedNames}. Дараа нь дахин оролдоно уу.`
          );
        }
      }

      closeCreateBoardModal(true);
    } catch (error) {
      const message =
        error.response?.data?.message || "Самбар нэмэхэд алдаа гарлаа.";
      setCreateError(message);
    } finally {
      setCreateSaving(false);
    }
  };

  const openEditBoardModal = (board) => {
    if (!board) {
      return;
    }
    setEditForm({
      name: board.name || "",
      description: board.description || "",
    });
    setEditError("");
    setSelectedMemberId("");
    setMemberActionError("");
    setMemberActionPending(false);
    setBoardMembersState({ items: [], loading: true, error: "" });
    setEditingBoard(board);
  };

  const closeEditBoardModal = (force = false) => {
    if ((editSaving || memberActionPending) && !force) {
      return;
    }
    setEditingBoard(null);
    setEditForm({ name: "", description: "" });
    setEditError("");
    setBoardMembersState({ items: [], loading: false, error: "" });
    setSelectedMemberId("");
    setMemberActionError("");
    setMemberActionPending(false);
  };

  const handleEditInputChange = (event) => {
    const { name, value } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleMemberSelectChange = (nextValue) => {
    setSelectedMemberId(String(nextValue || ""));
    if (memberActionError) {
      setMemberActionError("");
    }
  };

  const handleAddMemberToBoard = async () => {
    if (!editingBoard) {
      return;
    }
    if (!selectedMemberId) {
      setMemberActionError("Нэмж оруулах ажилтнаа сонгоно уу.");
      return;
    }
    const alreadyMember = boardMembersState.items.some(
      (member) => String(member.id) === String(selectedMemberId)
    );
    if (alreadyMember) {
      setMemberActionError("Энэ гишүүн аль хэдийн нэмэгдсэн байна.");
      return;
    }
    setMemberActionPending(true);
    setMemberActionError("");
    try {
      await apiClient.post(`/boards/${editingBoard.id}/members`, {
        employeeId: selectedMemberId,
      });

      const employee = employeesState.items.find(
        (item) => String(item.id) === String(selectedMemberId)
      );

      const newMember = employee
        ? {
            id: employee.id,
            first_name: employee.first_name,
            last_name: employee.last_name,
            email: employee.email,
            position_title: employee.position_title,
          }
        : { id: Number(selectedMemberId) || selectedMemberId };

      setBoardMembersState((prev) => {
        const nextItems = [...prev.items, newMember].sort(
          compareEmployeesByName
        );
        return {
          items: nextItems,
          loading: false,
          error: "",
        };
      });

      const nextCount = adjustMemberCount(editingBoard.member_count, 1);
      setEditingBoard((prev) =>
        prev ? { ...prev, member_count: nextCount } : prev
      );
      setBoardsState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === editingBoard.id
            ? {
                ...item,
                member_count: adjustMemberCount(item.member_count, 1),
              }
            : item
        ),
      }));
      setSelectedMemberId("");
    } catch (error) {
      const message =
        error.response?.data?.message || "Гишүүн нэмэхэд алдаа гарлаа.";
      setMemberActionError(message);
    } finally {
      setMemberActionPending(false);
    }
  };

  const handleRemoveMemberFromBoard = async (memberId) => {
    if (!editingBoard) {
      return;
    }
    setMemberActionPending(true);
    setMemberActionError("");
    try {
      await apiClient.delete(`/boards/${editingBoard.id}/members/${memberId}`);

      setBoardMembersState((prev) => ({
        items: prev.items
          .filter((member) => String(member.id) !== String(memberId))
          .sort(compareEmployeesByName),
        loading: false,
        error: "",
      }));

      const nextCount = adjustMemberCount(editingBoard.member_count, -1);
      setEditingBoard((prev) =>
        prev ? { ...prev, member_count: nextCount } : prev
      );
      setBoardsState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === editingBoard.id
            ? {
                ...item,
                member_count: adjustMemberCount(item.member_count, -1),
              }
            : item
        ),
      }));
    } catch (error) {
      const message =
        error.response?.data?.message || "Гишүүн хасахад алдаа гарлаа.";
      setMemberActionError(message);
    } finally {
      setMemberActionPending(false);
    }
  };

  const handleSubmitEdit = async (event) => {
    event.preventDefault();
    if (!editingBoard) {
      return;
    }
    const payload = {
      name: editForm.name.trim(),
      description: editForm.description.trim() || null,
    };
    if (!payload.name) {
      setEditError("Нэр заавал хэрэгтэй.");
      return;
    }
    setEditSaving(true);
    setEditError("");
    try {
      const response = await apiClient.patch(
        `/boards/${editingBoard.id}`,
        payload
      );
      const updatedBoard = response.data?.board;
      if (updatedBoard) {
        setBoardsState((prev) => ({
          ...prev,
          items: prev.items.map((item) =>
            item.id === updatedBoard.id ? { ...item, ...updatedBoard } : item
          ),
        }));
      } else {
        setBoardsState((prev) => ({
          ...prev,
          items: prev.items.map((item) =>
            item.id === editingBoard.id
              ? {
                  ...item,
                  name: payload.name || item.name,
                  description:
                    typeof payload.description === "undefined"
                      ? item.description
                      : payload.description,
                }
              : item
          ),
        }));
      }
      closeEditBoardModal();
    } catch (error) {
      const message =
        error.response?.data?.message || "Самбар засахад алдаа гарлаа.";
      setEditError(message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteBoard = async (boardId) => {
    if (!boardId) {
      return;
    }
    const confirmed = window.confirm("Энэ самбарыг устгах уу?");
    if (!confirmed) {
      return;
    }
    try {
      await apiClient.delete(`/boards/${boardId}`);
      if (editingBoard?.id === boardId) {
        closeEditBoardModal(true);
      }
      setBoardsState((prev) => ({
        ...prev,
        items: prev.items.filter((item) => item.id !== boardId),
      }));
    } catch (error) {
      const message =
        error.response?.data?.message || "Самбар устгахад алдаа гарлаа.";
      window.alert(message);
    }
  };

  const cards = filteredBoards.map((board) => {
    const memberCount = Number(board.member_count) || 0;
    const workspaceName =
      workspaceLookup[String(board.workspace_id)] || "Workspace тодорхойгүй";
    return (
      <article
        key={board.id}
        className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-base font-semibold text-slate-700">
              {board.name?.slice(0, 1)?.toUpperCase() || "B"}
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {board.name || "Нэргүй самбар"}
              </h3>
              <p className="text-xs text-slate-500">{workspaceName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              onClick={() => openEditBoardModal(board)}
            >
              Засах
            </button>
            <button
              type="button"
              className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600 transition hover:border-rose-300 hover:bg-rose-100"
              onClick={() => handleDeleteBoard(board.id)}
            >
              Устгах
            </button>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-4 px-5 py-4">
          <p className="line-clamp-3 text-sm text-slate-600">
            {board.description || "Тайлбар алга."}
          </p>
          <div className="flex flex-wrap items-center gap-4 justify-between mt-8 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {memberCount} {memberCount === 1 ? "гишүүн" : "гишүүд"}
            </span>
            <span>Шинэчлэгдсэн: {formatDate(board.updated_at)}</span>
          </div>
          <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
            <span className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
                {buildCreatorInitials(board)}
              </span>
              <span className="font-medium text-slate-700">
                {buildCreatorName(board)}
              </span>
            </span>
            <Link
              to={`/tasks/boards/${board.id}`}
              state={{ boardName: board.name || "Нэргүй самбар" }}
              className="text-xs font-semibold text-slate-600 underline-offset-4 transition hover:text-slate-900 hover:underline cursor-pointer"
            >
              дэлгэрэнгүй
            </Link>
          </div>
        </div>
      </article>
    );
  });

  return (
    <div className="min-h-full bg-white mx-6 px-6 rounded-[30px] shadow-lg">
      <section className=" bg-white px-6 py-8 ">
        <div className=" flex  flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold  text-slate-900">Самбар</h1>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2">
                <span className="text-base font-semibold text-slate-900">
                  {boardsState.items.length}
                </span>
                <span className="ml-2 text-xs  tracking-wide">Самбар</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2">
                <span className="text-base font-semibold text-slate-900">
                  {totalMembers}
                </span>
                <span className="ml-2 text-xs  tracking-wide">Гишүүд</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-65 max-w-md">
              <img
                src={SearchIcon}
                alt="Search"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50"
              />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Самбар хайх..."
                className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-700 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                onClick={openCreateBoardModal}
              >
                Самбар нэмэх
              </button>
              <button
                type="button"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                onClick={() => navigate("/tasks/workspace")}
              >
                Manage workspaces
              </button>
            </div>
          </div>
        </div>
      </section>

      <main className=" max-w-6xl px-6 py-8 shadow-sm rounded-[26px]">
        {boardsState.loading ? (
          <p className="text-sm text-slate-500">
            Самбарын мэдээлэл ачаалж байна...
          </p>
        ) : boardsState.error ? (
          <p className="text-sm text-rose-500">{boardsState.error}</p>
        ) : filteredBoards.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cards}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            {searchTerm.trim()
              ? "Хайлтад тохирох самбар олдсонгүй."
              : "Самбар олдсонгүй."}
          </p>
        )}
      </main>

      {creatingBoard ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <header className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Самбар нэмэх
                </h2>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                onClick={closeCreateBoardModal}
                disabled={createSaving}
              >
                X
              </button>
            </header>
            <form className="space-y-4" onSubmit={handleSubmitCreate}>
              <div>
                <label
                  className="mb-1 block text-xs font-semibold text-slate-700"
                  htmlFor="board-workspace"
                >
                  Workspace
                </label>
                <select
                  id="board-workspace"
                  name="workspaceId"
                  value={createForm.workspaceId}
                  onChange={handleCreateInputChange}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  disabled={createSaving || workspacesState.loading}
                >
                  <option value="">Workspace сонгоно уу</option>
                  {workspacesState.items.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name || "Нэргүй workspace"}
                    </option>
                  ))}
                </select>
                {workspacesState.error ? (
                  <p className="mt-1 text-xs text-rose-500">
                    {workspacesState.error}
                  </p>
                ) : null}
              </div>
              <div>
                <label
                  className="mb-1 block text-xs font-semibold text-slate-700"
                  htmlFor="create-board-name"
                >
                  Гарчиг
                </label>
                <input
                  id="create-board-name"
                  name="name"
                  type="text"
                  value={createForm.name}
                  onChange={handleCreateInputChange}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Самбарын нэр"
                  disabled={createSaving}
                />
              </div>
              <div>
                <label
                  className="mb-1 block text-xs font-semibold text-slate-700"
                  htmlFor="create-board-description"
                >
                  Тайлбар
                </label>
                <textarea
                  id="create-board-description"
                  name="description"
                  rows={4}
                  value={createForm.description}
                  onChange={handleCreateInputChange}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Товч тайлбар"
                  disabled={createSaving}
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Гишүүд
                  </span>
                  <span className="text-xs text-slate-400">
                    {createMembers.length}{" "}
                    {createMembers.length === 1 ? "гишүүн" : "гишүүд"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="min-w-50 flex-1 sm:max-w-xs">
                    <EmployeeSelectField
                      label=""
                      placeholder="Ажилтан"
                      value={createSelectedMemberId}
                      onChange={handleCreateMemberSelectChange}
                      options={availableEmployeeOptionsForCreate}
                      disabled={
                        createSaving ||
                        employeesState.loading ||
                        availableEmployeesForCreate.length === 0
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleAddMemberToCreate}
                    disabled={
                      createSaving ||
                      employeesState.loading ||
                      !createSelectedMemberId ||
                      availableEmployeesForCreate.length === 0
                    }
                  >
                    Гишүүн нэмэх
                  </button>
                </div>
                {employeesState.loading ? (
                  <p className="mt-2 text-xs text-slate-400">
                    Ажилчдын жагсаалтыг ачаалж байна...
                  </p>
                ) : null}
                {employeesState.error ? (
                  <p className="mt-2 text-xs text-rose-500">
                    {employeesState.error}
                  </p>
                ) : null}
                {!employeesState.loading &&
                !employeesState.error &&
                availableEmployeesForCreate.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">
                    Нэмэх боломжтой ажилтан алга.
                  </p>
                ) : null}
                {createMemberError ? (
                  <p className="mt-2 text-xs text-rose-500">
                    {createMemberError}
                  </p>
                ) : null}
                <div className="mt-4 max-h-48 overflow-auto rounded-xl border border-slate-200 bg-white">
                  {createMembers.length ? (
                    <ul className="divide-y divide-slate-100">
                      {createMembers.map((member) => (
                        <li
                          key={member.id}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-700">
                              {formatEmployeeName(member)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {[member.email, member.position_title]
                                .filter(Boolean)
                                .join(" · ") || "Мэдээлэл байхгүй"}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600 transition hover:border-rose-300 hover:bg-rose-100"
                            onClick={() =>
                              handleRemoveMemberFromCreate(member.id)
                            }
                            disabled={createSaving}
                          >
                            Хасах
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-3 text-xs text-slate-400">
                      Одоогоор гишүүн нэмэгдээгүй байна.
                    </p>
                  )}
                </div>
              </div>
              {createError ? (
                <p className="text-xs text-rose-500">{createError}</p>
              ) : null}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                  onClick={closeCreateBoardModal}
                  disabled={createSaving}
                >
                  Цуцлах
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                  disabled={createSaving}
                >
                  {createSaving ? "Хадгалаж байна..." : "Хадгалах"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editingBoard ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <header className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Самбар засах
                </h2>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                onClick={closeEditBoardModal}
                disabled={editSaving}
              >
                X
              </button>
            </header>
            <form className="space-y-4" onSubmit={handleSubmitEdit}>
              <div>
                <label
                  className="mb-1 block text-xs font-semibold text-slate-700"
                  htmlFor="board-name"
                >
                  Гарчиг
                </label>
                <input
                  id="board-name"
                  name="name"
                  type="text"
                  value={editForm.name}
                  onChange={handleEditInputChange}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Самбарын нэр"
                  disabled={editSaving}
                />
              </div>
              <div>
                <label
                  className="mb-1 block text-xs font-semibold text-slate-700"
                  htmlFor="board-description"
                >
                  Тайлбар
                </label>
                <textarea
                  id="board-description"
                  name="description"
                  rows={4}
                  value={editForm.description}
                  onChange={handleEditInputChange}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Товч тайлбар"
                  disabled={editSaving}
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Гишүүд
                  </span>
                  {boardMembersState.loading ? (
                    <span className="text-xs text-slate-400">
                      Гишүүдийг ачаалж байна...
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">
                      {boardMembersState.items.length}{" "}
                      {boardMembersState.items.length === 1
                        ? "Гишүүн"
                        : "гишүүд"}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="min-w-50 flex-1 sm:max-w-xs">
                    <EmployeeSelectField
                      label=""
                      placeholder="Ажилтан"
                      value={selectedMemberId}
                      onChange={handleMemberSelectChange}
                      options={availableEmployeeOptions}
                      disabled={
                        employeesState.loading ||
                        boardMembersState.loading ||
                        memberActionPending ||
                        availableEmployees.length === 0
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleAddMemberToBoard}
                    disabled={
                      memberActionPending ||
                      boardMembersState.loading ||
                      !selectedMemberId ||
                      availableEmployees.length === 0
                    }
                  >
                    {memberActionPending ? "Хадгалаж байна..." : "Гишүүн нэмэх"}
                  </button>
                </div>
                {employeesState.loading ? (
                  <p className="mt-2 text-xs text-slate-400">
                    Ажилчдын жагсаалтыг ачаалж байна...
                  </p>
                ) : null}
                {employeesState.error ? (
                  <p className="mt-2 text-xs text-rose-500">
                    {employeesState.error}
                  </p>
                ) : null}
                {!employeesState.loading &&
                !employeesState.error &&
                !boardMembersState.loading &&
                availableEmployees.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">
                    Нэмэх боломжтой ажилтан алга.
                  </p>
                ) : null}
                {boardMembersState.error ? (
                  <p className="mt-2 text-xs text-rose-500">
                    {boardMembersState.error}
                  </p>
                ) : null}
                {memberActionError ? (
                  <p className="mt-2 text-xs text-rose-500">
                    {memberActionError}
                  </p>
                ) : null}
                <div className="mt-4 max-h-48 overflow-auto rounded-xl border border-slate-200 bg-white">
                  {boardMembersState.loading ? (
                    <p className="px-4 py-3 text-xs text-slate-400">
                      Гишүүдийг ачаалж байна...
                    </p>
                  ) : boardMembersState.items.length ? (
                    <ul className="divide-y divide-slate-100">
                      {boardMembersState.items.map((member) => (
                        <li
                          key={member.id}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-700">
                              {formatEmployeeName(member)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {[member.email, member.position_title]
                                .filter(Boolean)
                                .join(" · ") || "Мэдээлэл байхгүй"}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() =>
                              handleRemoveMemberFromBoard(member.id)
                            }
                            disabled={memberActionPending}
                          >
                            Хасах
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-3 text-xs text-slate-400">
                      Одоогоор гишүүн нэмэгдээгүй байна.
                    </p>
                  )}
                </div>
              </div>
              {editError ? (
                <p className="text-xs text-rose-500">{editError}</p>
              ) : null}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                  onClick={closeEditBoardModal}
                  disabled={editSaving}
                >
                  Цуцлах
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                  disabled={editSaving}
                >
                  {editSaving ? "Хадгалаж байнаы..." : "Хадгалах"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Boards;

function EmployeeSelectField({
  label,
  placeholder,
  value,
  onChange,
  options = [],
  disabled = false,
}) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const activeOption = useMemo(
    () => options.find((option) => option.value === String(value || "")),
    [options, value]
  );

  const displayLabel = activeOption?.label || placeholder || "Сонгох";
  const isPlaceholder = !activeOption;

  const normalizedSearch = searchValue.trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    if (!normalizedSearch) {
      return options;
    }
    return options.filter((option) => {
      const labelText = option.label?.toLowerCase() ?? "";
      const metaText = option.meta?.toLowerCase() ?? "";
      return (
        labelText.includes(normalizedSearch) ||
        metaText.includes(normalizedSearch)
      );
    });
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
    if (disabled || options.length === 0) {
      return;
    }
    setIsOpen((previous) => !previous);
  };

  const handleSelect = (nextValue) => {
    onChange?.(nextValue);
    setIsOpen(false);
  };

  return (
    <label className="flex w-full flex-col gap-2 text-sm font-semibold text-slate-600">
      {label ? <span>{label}</span> : null}
      <div className="relative w-full">
        <button
          type="button"
          ref={triggerRef}
          onClick={toggleOpen}
          disabled={disabled || options.length === 0}
          className={`flex h-12 w-full items-center justify-between rounded-2xl border bg-white px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60 ${
            isOpen
              ? "border-slate-400 text-slate-800 shadow-sm"
              : "border-slate-200 text-slate-700 hover:border-slate-300"
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
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 rounded-2xl border border-slate-200 bg-white py-3 shadow-[0_20px_40px_rgba(15,23,42,0.08)]"
          >
            <div className="px-3 pb-3">
              <Searchbar
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder={placeholder || "Сонгох"}
                className="border-slate-200"
                inputProps={{
                  autoComplete: "off",
                  spellCheck: false,
                }}
              />
              {value ? (
                <div className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>Сонгосон</span>
                  <button
                    type="button"
                    onClick={() => onChange?.("")}
                    className="text-sky-600 transition hover:text-sky-700"
                  >
                    Цэвэрлэх
                  </button>
                </div>
              ) : null}
            </div>

            <ul role="listbox" className="max-h-64 overflow-y-auto px-3 pb-1">
              {filteredOptions.length === 0 ? (
                <li className="px-3 py-2 text-sm font-medium text-slate-400">
                  Хайлтад тохирох ажилтан алга.
                </li>
              ) : (
                filteredOptions.map((option) => {
                  const isActive = option.value === String(value || "");
                  return (
                    <li key={option.value} className="py-1">
                      <button
                        type="button"
                        onClick={() => handleSelect(option.value)}
                        className={`flex w-full items-center justify-between rounded-2xl px-4 py-2 text-left text-sm font-semibold transition hover:bg-slate-50 ${
                          isActive
                            ? "bg-slate-100 text-slate-700"
                            : "text-slate-600"
                        }`}
                        role="option"
                        aria-selected={isActive}
                      >
                        <span className="flex-1 truncate">
                          {option.label}
                          {option.meta ? (
                            <span className="mt-0.5 block text-xs font-medium text-slate-400">
                              {option.meta}
                            </span>
                          ) : null}
                        </span>
                        {isActive ? (
                          <span className="ml-4 inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-400 text-xs font-bold text-slate-600">
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
