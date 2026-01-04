import pool from "../config/db";
import { asyncHandler } from "../utils/asyncHandler";
import { parsePagination, buildPaginationMeta } from "../utils/pagination";

declare global {
  namespace Express {
    interface User {
      id?: number;
    }
    interface Request {
      user?: User;
    }
  }
}

const workspaceSelect = `
SELECT w.workspace_id AS id,
       w.name,
       w.description,
       w.created_by,
       w.created_at,
       w.updated_at
FROM workspaces w
WHERE w.deleted_at IS NULL
`;

export const listWorkspaces = asyncHandler(async (req, res) => {
  const { search, sort, order } = req.query;
  const { page, pageSize, offset } = parsePagination(req.query);

  const filters = [];
  const values = [];
  let idx = 1;

  if (search) {
    filters.push(`w.name ILIKE $${idx}`);
    values.push(`%${search}%`);
    idx += 1;
  }

  const filterSql = filters.length ? ` AND ${filters.join(" AND ")}` : "";
  const sortField = sort === "updated_at" ? "w.updated_at" : "w.created_at";
  const sortDirection = order === "asc" ? "ASC" : "DESC";

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM workspaces w WHERE w.deleted_at IS NULL${filterSql}`,
    values
  );

  const dataResult = await pool.query(
    `${workspaceSelect}
     ${filterSql}
     ORDER BY ${sortField} ${sortDirection}
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, pageSize, offset]
  );

  res.json({
    data: dataResult.rows,
    pagination: buildPaginationMeta(page, pageSize, countResult.rows[0].total),
  });
});

export const createWorkspace = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ message: "Name is required" });
  }

  const existing = await pool.query(
    `SELECT 1 FROM workspaces WHERE name ILIKE $1 AND deleted_at IS NULL`,
    [name]
  );
  if (existing.rows.length > 0) {
    return res.status(400).json({ message: "Workspace name already in use" });
  }

  const insertResult = await pool.query(
    `INSERT INTO workspaces (name, description, created_by)
     VALUES ($1,$2,$3)
     RETURNING workspace_id AS id`,
    [name, description, req.user?.id]
  );

  const workspace = await pool.query(
    `${workspaceSelect} AND w.workspace_id = $1`,
    [insertResult.rows[0].id]
  );

  return res.status(201).json({ workspace: workspace.rows[0] });
});

export const updateWorkspace = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const updates = [];
  const values = [];
  let idx = 1;

  if (name) {
    updates.push(`name = $${idx}`);
    values.push(name);
    idx += 1;
  }
  if (typeof description !== "undefined") {
    updates.push(`description = $${idx}`);
    values.push(description);
    idx += 1;
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: "No fields to update" });
  }

  updates.push(`updated_at = now()`);
  values.push(req.params["id"]);

  const result = await pool.query(
    `UPDATE workspaces SET ${updates.join(", ")}
     WHERE workspace_id = $${idx} AND deleted_at IS NULL
     RETURNING workspace_id AS id`,
    values
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Workspace not found" });
  }

  const workspace = await pool.query(
    `${workspaceSelect} AND w.workspace_id = $1`,
    [result.rows[0].id]
  );

  return res.json({ workspace: workspace.rows[0] });
});

export const deleteWorkspace = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `UPDATE workspaces SET deleted_at = now(), updated_at = now()
     WHERE workspace_id = $1 AND deleted_at IS NULL`,
    [req.params["id"]]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ message: "Workspace not found" });
  }
  return res.status(204).end();
});

export const getTaskOverview = asyncHandler(async (_req, res) => {
  const [
    boardsResult,
    workspacesResult,
    summaryResult,
    statusResult,
    boardDistributionResult,
    feedResult,
  ] = await Promise.all([
    pool.query(
      `SELECT b.board_id AS id,
                b.workspace_id,
                b.name,
                b.description,
                b.updated_at,
                w.name AS workspace_name
         FROM boards b
         JOIN workspaces w ON w.workspace_id = b.workspace_id AND w.deleted_at IS NULL
         WHERE b.deleted_at IS NULL
         ORDER BY b.updated_at DESC
         LIMIT 6`
    ),
    pool.query(
      `SELECT workspace_id AS id, name, description, updated_at
         FROM workspaces
         WHERE deleted_at IS NULL
         ORDER BY updated_at DESC NULLS LAST, created_at DESC
         LIMIT 6`
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'Working On It')::int AS in_progress,
                COUNT(*) FILTER (WHERE status = 'Done')::int AS done,
                COUNT(*) FILTER (WHERE status = 'Stuck')::int AS stuck
         FROM tasks
         WHERE deleted_at IS NULL`
    ),
    pool.query(
      `SELECT COALESCE(sg.name, 'Unassigned') AS name,
                COUNT(*)::int AS count
         FROM tasks t
         LEFT JOIN status_groups sg ON sg.status_group_id = t.status_group_id
         WHERE t.deleted_at IS NULL
         GROUP BY 1
         ORDER BY count DESC`
    ),
    pool.query(
      `SELECT b.board_id AS id,
                b.name,
                COUNT(*)::int AS count
         FROM tasks t
         JOIN boards b ON b.board_id = t.board_id
         WHERE t.deleted_at IS NULL
         GROUP BY b.board_id, b.name
         ORDER BY count DESC`
    ),
    pool.query(
      `SELECT a.activity_id AS id,
                a.task_id,
                t.title AS task_title,
                a.action,
                a.detail,
                a.created_at,
                u.first_name AS actor_first_name,
                u.last_name AS actor_last_name
         FROM task_activity a
         JOIN tasks t ON t.task_id = a.task_id
         LEFT JOIN users u ON u.user_id = a.actor_id
         ORDER BY a.created_at DESC
         LIMIT 10`
    ),
  ]);

  const summaryRow = summaryResult.rows[0] ?? {};

  res.json({
    boards: boardsResult.rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      description: row.description,
      workspaceName: row.workspace_name,
      updatedAt: row.updated_at,
    })),
    workspaces: workspacesResult.rows,
    summary: {
      totalTasks: summaryRow.total ?? 0,
      inProgressTasks: summaryRow.in_progress ?? 0,
      doneTasks: summaryRow.done ?? 0,
      stuckTasks: summaryRow.stuck ?? 0,
    },
    statusBreakdown: statusResult.rows,
    boardDistribution: boardDistributionResult.rows,
    feed: feedResult.rows.map((row) =>
      [row.actor_first_name, row.actor_last_name].filter(Boolean).join(" ") ||
      null
        ? {
            id: row.id,
            taskId: row.task_id,
            taskTitle: row.task_title,
            action: row.action,
            detail: row.detail,
            createdAt: row.created_at,
            actorName:
              [row.actor_first_name, row.actor_last_name]
                .filter(Boolean)
                .join(" ") || null,
          }
        : {
            id: row.id,
            taskId: row.task_id,
            taskTitle: row.task_title,
            action: row.action,
            detail: row.detail,
            createdAt: row.created_at,
            actorName: null,
          }
    ),
  });
});

const boardSelectBase = `
SELECT b.board_id AS id,
       b.workspace_id,
       b.name,
       b.description,
       b.created_at,
       b.updated_at,
       b.created_by,
       MAX(u.first_name) AS creator_first_name,
       MAX(u.last_name) AS creator_last_name,
       MAX(u.email) AS creator_email,
       COUNT(DISTINCT bm.employee_id) AS member_count
FROM boards b
LEFT JOIN users u ON u.user_id = b.created_by
LEFT JOIN board_members bm ON bm.board_id = b.board_id
WHERE b.deleted_at IS NULL`;

const boardGroupBy = `
GROUP BY b.board_id
`;

export const listBoards = asyncHandler(async (req, res) => {
  const { workspaceId } = req.query;
  const values = [];

  let query = `${boardSelectBase}
    ${boardGroupBy}`;
  if (workspaceId) {
    query = `${boardSelectBase}
      AND b.workspace_id = $1
      ${boardGroupBy}`;
    values.push(workspaceId);
  }

  const boards = await pool.query(query, values);
  res.json({ data: boards.rows });
});

export const getBoard = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT b.board_id AS id,
            b.workspace_id,
            w.name AS workspace_name,
            b.name,
            b.description,
            b.created_at,
            b.updated_at,
            b.created_by,
            MAX(u.first_name) AS creator_first_name,
            MAX(u.last_name) AS creator_last_name,
            MAX(u.email) AS creator_email,
            COUNT(DISTINCT bm.employee_id) AS member_count
     FROM boards b
     LEFT JOIN workspaces w ON w.workspace_id = b.workspace_id AND w.deleted_at IS NULL
     LEFT JOIN users u ON u.user_id = b.created_by
     LEFT JOIN board_members bm ON bm.board_id = b.board_id
     WHERE b.deleted_at IS NULL
       AND b.board_id = $1
     GROUP BY b.board_id, w.name`,
    [req.params["id"]]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Board not found" });
  }

  return res.json({ board: result.rows[0] });
});

export const createBoard = asyncHandler(async (req, res) => {
  const { workspaceId, name, description } = req.body;
  if (!workspaceId || !name) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const workspaceCheck = await pool.query(
    `SELECT 1 FROM workspaces WHERE workspace_id = $1 AND deleted_at IS NULL`,
    [workspaceId]
  );
  if (workspaceCheck.rows.length === 0) {
    return res.status(400).json({ message: "Workspace not found" });
  }

  const insertResult = await pool.query(
    `INSERT INTO boards (workspace_id, name, description, created_by)
     VALUES ($1,$2,$3,$4)
     RETURNING board_id AS id`,
    [workspaceId, name, description, req.user?.id]
  );

  const board = await pool.query(
    `${boardSelectBase}
     AND b.board_id = $1
     ${boardGroupBy}`,
    [insertResult.rows[0].id]
  );

  return res.status(201).json({ board: board.rows[0] });
});

export const updateBoard = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const updates = [];
  const values = [];
  let idx = 1;

  if (name) {
    updates.push(`name = $${idx}`);
    values.push(name);
    idx += 1;
  }
  if (typeof description !== "undefined") {
    updates.push(`description = $${idx}`);
    values.push(description);
    idx += 1;
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: "No fields to update" });
  }

  updates.push(`updated_at = now()`);
  values.push(req.params["id"]);

  const result = await pool.query(
    `UPDATE boards SET ${updates.join(", ")}
     WHERE board_id = $${idx} AND deleted_at IS NULL
     RETURNING board_id AS id`,
    values
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Board not found" });
  }

  const board = await pool.query(
    `${boardSelectBase}
     AND b.board_id = $1
     ${boardGroupBy}`,
    [result.rows[0].id]
  );

  return res.json({ board: board.rows[0] });
});

export const deleteBoard = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `UPDATE boards SET deleted_at = now(), updated_at = now()
     WHERE board_id = $1 AND deleted_at IS NULL`,
    [req.params["id"]]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ message: "Board not found" });
  }

  return res.status(204).end();
});

export const listBoardMembers = asyncHandler(async (req, res) => {
  const boardId = req.params["id"];
  const members = await pool.query(
    `SELECT e.employee_id AS id,
            e.first_name,
            e.last_name,
            e.email,
            e.position_title
     FROM board_members bm
     JOIN employees e ON e.employee_id = bm.employee_id
     WHERE bm.board_id = $1
       AND e.deleted_at IS NULL
     ORDER BY e.first_name, e.last_name`,
    [boardId]
  );

  res.json({ data: members.rows });
});

export const addBoardMember = asyncHandler(async (req, res) => {
  const { employeeId } = req.body;
  const boardId = req.params["id"];
  if (!employeeId) {
    return res.status(400).json({ message: "employeeId is required" });
  }

  const employeeExists = await pool.query(
    `SELECT 1 FROM employees WHERE employee_id = $1 AND deleted_at IS NULL`,
    [employeeId]
  );
  if (employeeExists.rows.length === 0) {
    return res.status(400).json({ message: "Employee not found" });
  }

  await pool.query(
    `INSERT INTO board_members (board_id, employee_id)
     VALUES ($1, $2)
     ON CONFLICT (board_id, employee_id) DO NOTHING`,
    [boardId, employeeId]
  );

  return res.status(204).end();
});

export const removeBoardMember = asyncHandler(async (req, res) => {
  const { id, employeeId } = req.params;
  await pool.query(
    `DELETE FROM board_members WHERE board_id = $1 AND employee_id = $2`,
    [id, employeeId]
  );
  res.status(204).end();
});

const taskSelectBase = `
SELECT t.task_id AS id,
       t.board_id,
       t.status_group_id,
       t.title,
       t.task_group,
       t.description,
       t.planned_start_date,
       t.planned_end_date,
       t.status,
       t.created_at,
       t.updated_at,
       sg.name AS status_group,
       b.name AS board_name,
       ARRAY_REMOVE(ARRAY_AGG(DISTINCT ta.employee_id), NULL) AS assignees
FROM tasks t
JOIN boards b ON b.board_id = t.board_id
LEFT JOIN status_groups sg ON sg.status_group_id = t.status_group_id
LEFT JOIN task_assignees ta ON ta.task_id = t.task_id
WHERE t.deleted_at IS NULL`;

const taskGroupBy = `
GROUP BY t.task_id, sg.name, b.name
`;

export const listTasks = asyncHandler(async (req, res) => {
  const { boardId, status, search, assigneeId, sort, order } = req.query;
  const { page, pageSize, offset } = parsePagination(req.query);

  const filters = [];
  const values = [];
  let idx = 1;

  if (boardId) {
    filters.push(`t.board_id = $${idx}`);
    values.push(boardId);
    idx += 1;
  }
  if (status) {
    filters.push(`t.status = $${idx}`);
    values.push(status);
    idx += 1;
  }
  if (search) {
    filters.push(`(t.title ILIKE $${idx} OR t.description ILIKE $${idx})`);
    values.push(`%${search}%`);
    idx += 1;
  }
  if (assigneeId) {
    filters.push(
      `EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.task_id AND ta.employee_id = $${idx})`
    );
    values.push(assigneeId);
    idx += 1;
  }

  const filterSql = filters.length ? ` AND ${filters.join(" AND ")}` : "";
  const sortField = sort === "updated_at" ? "t.updated_at" : "t.created_at";
  const sortDirection = order === "asc" ? "ASC" : "DESC";

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM tasks t WHERE t.deleted_at IS NULL${filterSql}`,
    values
  );

  const dataResult = await pool.query(
    `${taskSelectBase}
     ${filterSql}
     ${taskGroupBy}
     ORDER BY ${sortField} ${sortDirection}
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, pageSize, offset]
  );

  res.json({
    data: dataResult.rows,
    pagination: buildPaginationMeta(page, pageSize, countResult.rows[0].total),
  });
});

export const createTask = asyncHandler(async (req, res) => {
  const {
    boardId,
    board_id,
    board,
    statusGroupId,
    status_group_id,
    title,
    name,
    taskGroup,
    description,
    plannedStartDate,
    plannedEndDate,
    status,
    assigneeIds,
    assignee_ids,
  } = req.body;

  type IdentifierInput = string | number | null | undefined;
  type IdentifierOutput = string | number | null;

  const normalizeIdentifier = (value: IdentifierInput): IdentifierOutput => {
    if (value === null || typeof value === "undefined") {
      return null;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    }
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    return null;
  };

  const queryBoardId = req.query?.["boardId"];
  const normalizedBoardId =
    normalizeIdentifier(boardId) ??
    normalizeIdentifier(board_id) ??
    normalizeIdentifier(board?.id) ??
    normalizeIdentifier(
      typeof queryBoardId === "string" || typeof queryBoardId === "number"
        ? queryBoardId
        : undefined
    );

  const queryStatusGroupId = req.query?.["statusGroupId"];
  const normalizedStatusGroupId =
    normalizeIdentifier(statusGroupId) ??
    normalizeIdentifier(status_group_id) ??
    normalizeIdentifier(
      typeof queryStatusGroupId === "string" ||
        typeof queryStatusGroupId === "number"
        ? queryStatusGroupId
        : undefined
    );

  const normalizedTitle = (title ?? name ?? "").trim();

  const inputAssigneeIds = assigneeIds ?? assignee_ids;
  const normalizedAssigneeIds = Array.isArray(inputAssigneeIds)
    ? (inputAssigneeIds as IdentifierInput[])
        .map((value: IdentifierInput) => normalizeIdentifier(value))
        .filter((value) => value !== null)
    : [];

  if (!normalizedBoardId || !normalizedTitle) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const boardExists = await pool.query(
    `SELECT 1 FROM boards WHERE board_id = $1 AND deleted_at IS NULL`,
    [normalizedBoardId]
  );
  if (boardExists.rows.length === 0) {
    return res.status(400).json({ message: "Board not found" });
  }

  const statusGroupCheck = normalizedStatusGroupId
    ? await pool.query(
        `SELECT 1 FROM status_groups WHERE status_group_id = $1 AND board_id = $2`,
        [normalizedStatusGroupId, normalizedBoardId]
      )
    : { rows: [{ exists: true }] };

  if (normalizedStatusGroupId && statusGroupCheck.rows.length === 0) {
    return res.status(400).json({ message: "Invalid status group" });
  }

  const insertResult = await pool.query(
    `INSERT INTO tasks (
       board_id, status_group_id, title, task_group, description,
       planned_start_date, planned_end_date, status, created_by, updated_by
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
     RETURNING task_id AS id`,
    [
      normalizedBoardId,
      normalizedStatusGroupId ?? null,
      normalizedTitle,
      taskGroup,
      description,
      plannedStartDate ?? null,
      plannedEndDate ?? null,
      status,
      req.user?.id || null,
    ]
  );

  const taskId = insertResult.rows[0].id;

  if (normalizedAssigneeIds.length > 0) {
    type AssigneeValue = string | number;
    const assigneeValues: AssigneeValue[] = [];
    const placeholders = normalizedAssigneeIds
      .map((employeeId, index) => {
        assigneeValues.push(taskId, employeeId);
        const base = index * 2;
        return `($${base + 1}, $${base + 2})`;
      })
      .join(", ");
    await pool.query(
      `INSERT INTO task_assignees (task_id, employee_id)
       VALUES ${placeholders}
       ON CONFLICT (task_id, employee_id) DO NOTHING`,
      assigneeValues
    );
  }

  const task = await pool.query(
    `${taskSelectBase}
     AND t.task_id = $1
     ${taskGroupBy}`,
    [taskId]
  );

  return res.status(201).json({ task: task.rows[0] });
});

export const updateTask = asyncHandler(async (req, res) => {
  const {
    statusGroupId,
    title,
    taskGroup,
    description,
    plannedStartDate,
    plannedEndDate,
    status,
    assigneeIds,
  } = req.body;

  if (statusGroupId) {
    const statusGroupCheck = await pool.query(
      `SELECT 1 FROM status_groups WHERE status_group_id = $1`,
      [statusGroupId]
    );
    if (statusGroupCheck.rows.length === 0) {
      return res.status(400).json({ message: "Invalid status group" });
    }
  }

  const updates = [];
  const values = [];
  let idx = 1;

  if (statusGroupId) {
    updates.push(`status_group_id = $${idx}`);
    values.push(statusGroupId);
    idx += 1;
  }
  if (title) {
    updates.push(`title = $${idx}`);
    values.push(title);
    idx += 1;
  }
  if (typeof taskGroup !== "undefined") {
    updates.push(`task_group = $${idx}`);
    values.push(taskGroup);
    idx += 1;
  }
  if (typeof description !== "undefined") {
    updates.push(`description = $${idx}`);
    values.push(description);
    idx += 1;
  }
  if (typeof plannedStartDate !== "undefined") {
    updates.push(`planned_start_date = $${idx}`);
    values.push(plannedStartDate);
    idx += 1;
  }
  if (typeof plannedEndDate !== "undefined") {
    updates.push(`planned_end_date = $${idx}`);
    values.push(plannedEndDate);
    idx += 1;
  }
  if (status) {
    updates.push(`status = $${idx}`);
    values.push(status);
    idx += 1;
  }

  if (updates.length === 0 && typeof assigneeIds === "undefined") {
    return res.status(400).json({ message: "No fields to update" });
  }

  if (updates.length > 0) {
    updates.push(`updated_at = now()`);
    values.push(req.params["id"]);

    const result = await pool.query(
      `UPDATE tasks SET ${updates.join(", ")}
       WHERE task_id = $${idx} AND deleted_at IS NULL
       RETURNING task_id AS id`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Task not found" });
    }
  }

  if (Array.isArray(assigneeIds)) {
    await pool.query(`DELETE FROM task_assignees WHERE task_id = $1`, [
      req.params["id"],
    ]);
    if (assigneeIds.length > 0) {
      const taskId = req.params["id"] as string;
      const assigneeValues: Array<string | number> = [];
      const placeholders = (assigneeIds as Array<string | number>)
        .map((employeeId, index) => {
          assigneeValues.push(taskId, employeeId);
          const base = index * 2;
          return `($${base + 1}, $${base + 2})`;
        })
        .join(", ");
      await pool.query(
        `INSERT INTO task_assignees (task_id, employee_id)
         VALUES ${placeholders}
         ON CONFLICT (task_id, employee_id) DO NOTHING`,
        assigneeValues
      );
    }
  }

  const task = await pool.query(
    `${taskSelectBase}
     AND t.task_id = $1
     ${taskGroupBy}`,
    [req.params["id"]]
  );

  if (task.rows.length === 0) {
    return res.status(404).json({ message: "Task not found" });
  }

  return res.json({ task: task.rows[0] });
});

export const deleteTask = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `UPDATE tasks SET deleted_at = now(), updated_at = now()
     WHERE task_id = $1 AND deleted_at IS NULL`,
    [req.params["id"]]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ message: "Task not found" });
  }

  return res.status(204).end();
});

export const listStatusGroups = asyncHandler(async (req, res) => {
  const boardId = req.params["boardId"];
  const result = await pool.query(
    `SELECT status_group_id AS id, board_id, name, position
     FROM status_groups
     WHERE board_id = $1
     ORDER BY position ASC`,
    [boardId]
  );
  return res.json({ data: result.rows });
});

export const createStatusGroup = asyncHandler(async (req, res) => {
  const boardId = req.params["boardId"];
  const { name, position = 0 } = req.body;
  if (!name) {
    return res.status(400).json({ message: "Name is required" });
  }

  const insertResult = await pool.query(
    `INSERT INTO status_groups (board_id, name, position)
     VALUES ($1,$2,$3)
     RETURNING status_group_id AS id, board_id, name, position`,
    [boardId, name, position]
  );

  return res.status(201).json({ statusGroup: insertResult.rows[0] });
});

export const updateStatusGroup = asyncHandler(async (req, res) => {
  const { name, position } = req.body;
  const updates = [];
  const values = [];
  let idx = 1;

  if (name) {
    updates.push(`name = $${idx}`);
    values.push(name);
    idx += 1;
  }
  if (typeof position !== "undefined") {
    updates.push(`position = $${idx}`);
    values.push(position);
    idx += 1;
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: "No fields to update" });
  }

  values.push(req.params["statusGroupId"]);

  const result = await pool.query(
    `UPDATE status_groups SET ${updates.join(", ")}
     WHERE status_group_id = $${idx}
     RETURNING status_group_id AS id, board_id, name, position`,
    values
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Status group not found" });
  }

  return res.json({ statusGroup: result.rows[0] });
});

export const deleteStatusGroup = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `DELETE FROM status_groups WHERE status_group_id = $1`,
    [req.params["statusGroupId"]]
  );
  if (result.rowCount === 0) {
    return res.status(404).json({ message: "Status group not found" });
  }
  return res.status(204).end();
});

const mapTaskActivityRow = (row: any) => ({
  id: row.id,
  taskId: row.task_id,
  action: row.action,
  message: row.detail,
  createdAt: row.created_at,
  actor: row.actor_id
    ? {
        id: row.actor_id,
        firstName: row.actor_first_name ?? null,
        lastName: row.actor_last_name ?? null,
        displayName:
          [row.actor_first_name, row.actor_last_name]
            .filter(Boolean)
            .join(" ") || null,
      }
    : null,
});

export const listTaskActivity = asyncHandler(async (req, res) => {
  const taskId = req.params["id"];
  const result = await pool.query(
    `SELECT a.activity_id AS id,
            a.task_id,
            a.actor_id,
            a.action,
            a.detail,
            a.created_at,
            u.first_name AS actor_first_name,
            u.last_name AS actor_last_name
     FROM task_activity a
     LEFT JOIN users u ON u.user_id = a.actor_id
     WHERE a.task_id = $1
     ORDER BY a.created_at ASC`,
    [taskId]
  );
  res.json({ data: result.rows.map(mapTaskActivityRow) });
});

export const addTaskActivity = asyncHandler(async (req, res) => {
  const taskId = req.params["id"];
  const { action, detail, message } = req.body;
  const trimmedDetail = typeof detail === "string" ? detail.trim() : null;
  const trimmedMessage = typeof message === "string" ? message.trim() : null;
  const activityMessage = trimmedMessage || trimmedDetail;

  if (!activityMessage) {
    return res.status(400).json({ message: "Message is required" });
  }

  const resolvedAction = (action || "comment").trim() || "comment";

  const insertResult = await pool.query(
    `INSERT INTO task_activity (task_id, actor_id, action, detail)
     VALUES ($1,$2,$3,$4)
     RETURNING activity_id AS id, task_id, actor_id, action, detail, created_at`,
    [taskId, req.user?.id || null, resolvedAction, activityMessage]
  );

  const activityRow = insertResult.rows[0];

  const [lookup] = (
    await pool.query(
      `SELECT a.activity_id AS id,
              a.task_id,
              a.actor_id,
              a.action,
              a.detail,
              a.created_at,
              u.first_name AS actor_first_name,
              u.last_name AS actor_last_name
       FROM task_activity a
       LEFT JOIN users u ON u.user_id = a.actor_id
       WHERE a.activity_id = $1`,
      [activityRow.id]
    )
  ).rows;

  return res
    .status(201)
    .json({ activity: mapTaskActivityRow(lookup ?? activityRow) });
});

export default {
  listWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getTaskOverview,
  listBoards,
  createBoard,
  updateBoard,
  deleteBoard,
  addBoardMember,
  removeBoardMember,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  listStatusGroups,
  createStatusGroup,
  updateStatusGroup,
  deleteStatusGroup,
  listTaskActivity,
  addTaskActivity,
};
