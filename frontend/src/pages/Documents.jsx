import { Fragment, useEffect, useMemo, useState } from "react";
import Searchbar from "../components/Searchbar.jsx";
import BlackButton from "../components/BlackButton.jsx";
import WhiteButton from "../components/WhiteButton.jsx";
import apiClient from "../utils/apiClient.js";

const SORT_OPTIONS = [
  { value: "uploaded_at", label: "Нэмсэн" },
  { value: "updated_at", label: "Шинэчилсэн" },
  { value: "title", label: "Гарчиг" },
  { value: "category", label: "Төрөл" },
];

const GROUP_OPTIONS = [
  { value: "none", label: "Бүгд" },
  { value: "category", label: "Төрлөөр" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 40];

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const compareStrings = (left, right) =>
  (left ?? "").localeCompare(right ?? "", undefined, {
    sensitivity: "base",
    numeric: true,
  });

const useDebouncedValue = (value, delay = 400) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);

  return debounced;
};

function DocumentFormModal({
  isOpen,
  mode,
  onClose,
  onSubmit,
  initialData,
  categories,
  isSaving,
  errorMessage,
}) {
  const [formState, setFormState] = useState({
    title: "",
    description: "",
    category: "",
    file: null,
  });

  useEffect(() => {
    if (!isOpen) {
      setFormState({ title: "", description: "", category: "", file: null });
      return;
    }

    setFormState({
      title: initialData?.title ?? "",
      description: initialData?.description ?? "",
      category: initialData?.category ?? "",
      file: null,
    });
  }, [initialData, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((current) => ({ ...current, [name]: value }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    setFormState((current) => ({ ...current, file }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(formState);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl ">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {mode === "edit" ? "Edit Document" : "New Document"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          <div className="space-y-2">
            <label
              htmlFor="document-title"
              className="text-sm font-medium text-slate-700"
            >
              Title
            </label>
            <input
              id="document-title"
              name="title"
              type="text"
              required
              value={formState.title}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="document-description"
              className="text-sm font-medium text-slate-700"
            >
              Description
            </label>
            <textarea
              id="document-description"
              name="description"
              rows={4}
              value={formState.description}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="document-category"
              className="text-sm font-medium text-slate-700"
            >
              Type
            </label>
            <input
              id="document-category"
              name="category"
              list="document-category-options"
              required
              value={formState.category}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
            <datalist id="document-category-options">
              {categories.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="document-file"
              className="text-sm font-medium text-slate-700"
            >
              File
            </label>
            <input
              id="document-file"
              name="file"
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt"
              onChange={handleFileChange}
              className="w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-black"
            />
            {mode === "edit" && initialData?.file_url ? (
              <p className="text-xs text-slate-500">
                Current file:{" "}
                <a
                  href={initialData.file_url}
                  className="font-medium text-slate-900 underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open
                </a>
              </p>
            ) : null}
          </div>

          {errorMessage ? (
            <p className="text-sm text-red-600">{errorMessage}</p>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <WhiteButton label="Cancel" onClick={onClose} />
            <BlackButton
              type="submit"
              label={
                isSaving
                  ? "Saving..."
                  : mode === "edit"
                  ? "Save Changes"
                  : "Create"
              }
              className={isSaving ? "cursor-not-allowed opacity-75" : ""}
            />
          </div>
        </form>
      </div>
    </div>
  );
}

function Documents() {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [banner, setBanner] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState("");
  const [categoriesVersion, setCategoriesVersion] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm.trim());
  const [sortField, setSortField] = useState("uploaded_at");
  const [sortDirection, setSortDirection] = useState("desc");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [groupBy, setGroupBy] = useState("none");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [paginationMeta, setPaginationMeta] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [activeDocument, setActiveDocument] = useState(null);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isActive = true;

    const fetchCategories = async () => {
      try {
        const response = await apiClient.get("/documents");
        if (!isActive) {
          return;
        }
        console.log("Categories response:", response);
        const categoryList = [...(response.data?.categories ?? [])].sort(
          (left, right) => compareStrings(left, right)
        );
        setCategories(categoryList);
        setCategoriesError("");
      } catch (error) {
        if (!isActive) {
          return;
        }
        const message =
          error?.response?.data?.message || "Unable to load document types.";
        setCategoriesError(message);
      }
    };

    fetchCategories();

    return () => {
      isActive = false;
    };
  }, [categoriesVersion]);

  useEffect(() => {
    let isActive = true;
    const fetchDocuments = async () => {
      setIsLoading(true);
      setFetchError("");
      try {
        const params = {
          page,
          pageSize,
        };

        if (debouncedSearch) {
          params.search = debouncedSearch;
        }

        if (selectedCategory !== "all") {
          params.category = selectedCategory;
        }

        if (sortField === "uploaded_at" || sortField === "updated_at") {
          params.sort = sortField;
          params.order = sortDirection;
        } else {
          params.sort = "uploaded_at";
          params.order = "desc";
        }

        const response = await apiClient.get("/documents", { params });
        if (!isActive) {
          return;
        }

        const payload = response.data ?? {};

        const extractArray = (source) => {
          if (!source) {
            return [];
          }
          if (Array.isArray(source)) {
            return source;
          }
          if (Array.isArray(source.data)) {
            return source.data;
          }
          if (Array.isArray(source.documents)) {
            return source.documents;
          }
          if (Array.isArray(source.items)) {
            return source.items;
          }
          if (source.data && typeof source.data === "object") {
            const nested = extractArray(source.data);
            if (nested.length) {
              return nested;
            }
          }
          const firstArray = Object.values(source).find((value) =>
            Array.isArray(value)
          );
          return Array.isArray(firstArray) ? firstArray : [];
        };

        const items = extractArray(payload);
        setDocuments(items);

        const extractMeta = (source) => {
          if (!source || typeof source !== "object") {
            return null;
          }
          if (source.pagination && typeof source.pagination === "object") {
            return source.pagination;
          }
          if (source.meta && typeof source.meta === "object") {
            return source.meta;
          }
          if (source.data && typeof source.data === "object") {
            return extractMeta(source.data);
          }
          return null;
        };

        const meta = extractMeta(payload);
        const fallbackTotal =
          typeof payload.total === "number"
            ? payload.total
            : typeof payload.count === "number"
            ? payload.count
            : undefined;

        const nextMeta =
          meta ??
          (typeof fallbackTotal === "number"
            ? {
                page,
                pageSize,
                total: fallbackTotal,
                totalPages: Math.max(
                  1,
                  Math.ceil(fallbackTotal / Math.max(pageSize, 1))
                ),
                hasNext: page * pageSize < fallbackTotal,
              }
            : null);

        setPaginationMeta(nextMeta);

        if (nextMeta) {
          if (
            typeof nextMeta.totalPages === "number" &&
            nextMeta.totalPages > 0 &&
            page > nextMeta.totalPages
          ) {
            setPage(nextMeta.totalPages);
            return;
          }
          if (typeof nextMeta.page === "number" && nextMeta.page !== page) {
            setPage(nextMeta.page);
          }
        } else if (page > 1 && items.length === 0) {
          setPage(1);
        }
      } catch (error) {
        if (!isActive) {
          return;
        }
        const message =
          error?.response?.data?.message || "Unable to load documents.";
        setFetchError(message);
        setPaginationMeta(null);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    fetchDocuments();

    return () => {
      isActive = false;
    };
  }, [
    debouncedSearch,
    sortField,
    sortDirection,
    selectedCategory,
    page,
    pageSize,
    reloadToken,
  ]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  const filteredDocuments = useMemo(() => {
    if (selectedCategory === "all") {
      return documents;
    }
    return documents.filter((doc) => doc.category === selectedCategory);
  }, [documents, selectedCategory]);

  const sortedDocuments = useMemo(() => {
    const items = [...filteredDocuments];
    const direction = sortDirection === "asc" ? 1 : -1;

    if (sortField === "title") {
      items.sort((a, b) => compareStrings(a.title, b.title) * direction);
    } else if (sortField === "category") {
      items.sort((a, b) => compareStrings(a.category, b.category) * direction);
    } else if (sortField === "uploaded_at" || sortField === "updated_at") {
      items.sort((a, b) => {
        const left = a?.[sortField] ? new Date(a[sortField]).getTime() : 0;
        const right = b?.[sortField] ? new Date(b[sortField]).getTime() : 0;
        return (left - right) * direction;
      });
    }

    return items;
  }, [filteredDocuments, sortField, sortDirection]);

  const groupedDocuments = useMemo(() => {
    if (groupBy !== "category") {
      return null;
    }

    const map = new Map();
    sortedDocuments.forEach((doc) => {
      const key = doc.category || "Uncategorized";
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(doc);
    });

    return Array.from(map.entries()).sort(([left], [right]) =>
      compareStrings(left, right)
    );
  }, [groupBy, sortedDocuments]);

  const totalItems = paginationMeta?.total ?? documents.length;
  const effectivePageSize = paginationMeta?.pageSize ?? pageSize;
  const totalPages =
    paginationMeta?.totalPages ??
    Math.max(1, Math.ceil(totalItems / Math.max(effectivePageSize, 1)));
  const currentPage = paginationMeta?.page ?? page;
  const hasPrevious = currentPage > 1;
  const hasNext = paginationMeta?.hasNext ?? currentPage < totalPages;
  const pageRange = totalItems
    ? (() => {
        const offset = (currentPage - 1) * effectivePageSize;
        const itemsOnPage = documents.length
          ? documents.length
          : Math.max(0, Math.min(effectivePageSize, totalItems - offset));
        const start = offset + 1;
        const end = Math.min(totalItems, start + Math.max(itemsOnPage - 1, 0));
        return { start, end };
      })()
    : null;

  const handleSearchChange = (event) => {
    if (page !== 1) {
      setPage(1);
    }
    setSearchTerm(event.target.value);
  };

  const handleSortFieldSelect = (value) => {
    if (value === sortField) {
      return;
    }
    setSortField(value);
    if (page !== 1) {
      setPage(1);
    }
  };

  const toggleSortDirection = () => {
    setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    if (page !== 1) {
      setPage(1);
    }
  };

  const handleCategoryFilterChange = (event) => {
    const { value } = event.target;
    if (value === selectedCategory) {
      return;
    }
    setSelectedCategory(value);
    if (page !== 1) {
      setPage(1);
    }
  };

  const handleGroupChange = (value) => {
    if (value === groupBy) {
      return;
    }
    setGroupBy(value);
    if (page !== 1) {
      setPage(1);
    }
  };

  const handlePreviousPage = () => {
    if (!hasPrevious) {
      return;
    }
    setPage((current) => Math.max(1, current - 1));
  };

  const handleNextPage = () => {
    if (!hasNext) {
      return;
    }
    setPage((current) => Math.min(current + 1, totalPages));
  };

  const resetFormState = () => {
    setFormError("");
    setIsFormOpen(false);
    setIsSaving(false);
    setActiveDocument(null);
  };

  const handleCreateClick = () => {
    setFormMode("create");
    setActiveDocument(null);
    setFormError("");
    setIsFormOpen(true);
  };

  const handleEditClick = (document) => {
    setFormMode("edit");
    setActiveDocument(document);
    setFormError("");
    setIsFormOpen(true);
  };

  const handleDeleteClick = async (document) => {
    const confirmed = window.confirm(
      `Delete the document "${document.title}"?`
    );
    if (!confirmed) {
      return;
    }

    try {
      await apiClient.delete(`/documents/${document.id}`);
      setBanner({ type: "success", message: "Document deleted." });
      setReloadToken((token) => token + 1);
      setCategoriesVersion((token) => token + 1);
    } catch (error) {
      const message =
        error?.response?.data?.message || "Unable to delete the document.";
      setBanner({ type: "error", message });
    }
  };

  const handleFormSubmit = async (formState) => {
    const trimmedTitle = formState.title.trim();
    const trimmedCategory = formState.category.trim();
    const trimmedDescription = formState.description.trim();

    if (!trimmedTitle || !trimmedCategory) {
      setFormError("Title and type are required.");
      return;
    }

    if (formMode === "create" && !formState.file) {
      setFormError("Please attach a file for the document.");
      return;
    }

    const formData = new FormData();
    formData.append("title", trimmedTitle);
    formData.append("category", trimmedCategory);
    formData.append("description", trimmedDescription);

    if (formState.file) {
      formData.append("file", formState.file);
    }

    setIsSaving(true);
    setFormError("");

    try {
      if (formMode === "edit" && activeDocument) {
        await apiClient.patch(`/documents/${activeDocument.id}`, formData);
        setBanner({ type: "success", message: "Document updated." });
      } else {
        await apiClient.post("/documents", formData);
        setBanner({ type: "success", message: "Document created." });
      }

      setReloadToken((token) => token + 1);
      setCategoriesVersion((token) => token + 1);
      setPage(1);
      resetFormState();
    } catch (error) {
      const message =
        error?.response?.data?.message || "Unable to save the document.";
      setFormError(message);
      setIsSaving(false);
    }
  };

  const closeModal = () => {
    resetFormState();
  };

  const renderRows = (items) => {
    if (!items.length) {
      return (
        <tr>
          <td colSpan={6} className="py-6 text-center text-sm text-slate-500">
            No documents to display.
          </td>
        </tr>
      );
    }

    return items.map((doc) => (
      <tr
        key={doc.id}
        className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
      >
        <td className="px-4 py-3 text-sm font-medium text-slate-900">
          {doc.title || "Untitled"}
        </td>
        <td className="px-4 py-3 text-sm text-slate-600">
          {doc.description || "—"}
        </td>
        <td className="px-4 py-3 text-sm text-slate-600">
          {doc.category || "Uncategorized"}
        </td>
        <td className="px-4 py-3 text-xs text-slate-500">
          {doc.uploaded_at
            ? dateFormatter.format(new Date(doc.uploaded_at))
            : "—"}
        </td>
        <td className="px-4 py-3 text-xs text-slate-500">
          {doc.updated_at
            ? dateFormatter.format(new Date(doc.updated_at))
            : "—"}
        </td>
        <td className="px-4 py-3 text-right text-sm">
          <div className="flex justify-end gap-2">
            {doc.file_url ? (
              <a
                href={doc.file_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-800"
              >
                Үзэх
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => handleEditClick(doc)}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-800"
            >
              Засах
            </button>
            <button
              type="button"
              onClick={() => handleDeleteClick(doc)}
              className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:border-red-400 hover:text-red-700"
            >
              Устгах
            </button>
          </div>
        </td>
      </tr>
    ));
  };

  return (
    <div className="min-h-full space-y-6 px-8 py-6 bg-white mx-6 rounded-[30px] shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Бичиг Баримт
          </h1>
        </div>
        <BlackButton label="Бичиг баримт нэмэх" onClick={handleCreateClick} />
      </div>

      <div className="flex flex-wrap items-center gap-3  bg-white p-4 ">
        <div className="min-w-55 flex-1">
          <Searchbar
            placeholder="Бичиг баримт"
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Жагсаах</span>
            <div className="flex gap-2">
              {SORT_OPTIONS.map((option) => (
                <WhiteButton
                  key={option.value}
                  label={option.label}
                  onClick={() => handleSortFieldSelect(option.value)}
                  isSelected={sortField === option.value}
                />
              ))}
            </div>
          </div>
          <WhiteButton
            label={sortDirection === "asc" ? "↑" : "↓"}
            onClick={toggleSortDirection}
            ariaLabel="Toggle sort direction"
            className="min-w-11"
          />
          <select
            value={selectedCategory}
            onChange={handleCategoryFilterChange}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none"
          >
            <option value="all">Бүх төрөл</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Ангилах</span>
            <div className="flex gap-2">
              {GROUP_OPTIONS.map((option) => (
                <WhiteButton
                  key={option.value}
                  label={option.label}
                  onClick={() => handleGroupChange(option.value)}
                  isSelected={groupBy === option.value}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {categoriesError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {categoriesError}
        </div>
      ) : null}

      {banner ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            banner.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {banner.message}
        </div>
      ) : null}

      {fetchError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {fetchError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-sm">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Гарчиг
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Тайлбар
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Type
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Нэмсэн
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Шинэчилсэн
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
              ></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-6 text-center text-sm text-slate-500"
                >
                  Loading documents...
                </td>
              </tr>
            ) : groupBy === "category" &&
              groupedDocuments &&
              groupedDocuments.length > 0 ? (
              groupedDocuments.map(([category, items]) => (
                <Fragment key={category}>
                  <tr className="bg-slate-100">
                    <td
                      colSpan={6}
                      className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600"
                    >
                      {category}
                    </td>
                  </tr>
                  {renderRows(items)}
                </Fragment>
              ))
            ) : groupBy === "category" &&
              groupedDocuments &&
              groupedDocuments.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-6 text-center text-sm text-slate-500"
                >
                  No documents to display.
                </td>
              </tr>
            ) : (
              renderRows(sortedDocuments)
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && groupBy !== "category" && totalItems > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
          <span className="text-sm text-slate-500">
            {pageRange
              ? `${pageRange.start} - ${pageRange.end} / ${totalItems}`
              : `${totalItems} documents`}
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
                    onClick={() => {
                      if (pageSize !== option) {
                        setPageSize(option);
                      }
                    }}
                    isSelected={pageSize === option}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <WhiteButton
                label="‹"
                onClick={handlePreviousPage}
                disabled={!hasPrevious || isLoading}
              />
              <span className="text-sm font-semibold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <WhiteButton
                label="›"
                onClick={handleNextPage}
                disabled={!hasNext || isLoading}
              />
            </div>
          </div>
        </div>
      ) : null}

      <DocumentFormModal
        isOpen={isFormOpen}
        mode={formMode}
        onClose={closeModal}
        onSubmit={handleFormSubmit}
        initialData={activeDocument}
        categories={categories}
        isSaving={isSaving}
        errorMessage={formError}
      />
    </div>
  );
}

export default Documents;
