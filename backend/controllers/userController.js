import bcrypt from "bcryptjs";
import pool from "../config/db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parsePagination, buildPaginationMeta } from "../utils/pagination.js";

const mapSortField = (sort = "created_at") => {
  const mapping = {
    created_at: "u.created_at",
    first_name: "u.first_name",
    last_name: "u.last_name",
    email: "u.email",
    role: "r.name",
  };
  return mapping[sort] || mapping.created_at;
};

export const listUsers = asyncHandler(async (req, res) => {
  const { search, role, isActive, sort, order } = req.query;
  const { page, pageSize, offset } = parsePagination(req.query);

  const filters = [];
  const values = [];
  let idx = 1;

  if (search) {
    filters.push(
      `(u.first_name ILIKE $${idx} OR u.last_name ILIKE $${idx} OR u.email ILIKE $${idx})`
    );
    values.push(`%${search}%`);
    idx += 1;
  }

  if (role) {
    filters.push(`r.name = $${idx}`);
    values.push(role);
    idx += 1;
  }

  if (typeof isActive !== "undefined") {
    filters.push(`u.is_active = $${idx}`);
    values.push(isActive === "true");
    idx += 1;
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const sortField = mapSortField(sort);
  const sortDirection = order === "desc" ? "DESC" : "ASC";

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM users u
     JOIN roles r ON r.role_id = u.role_id
     ${whereClause}`,
    values
  );

  const userResult = await pool.query(
    `SELECT u.user_id AS id, u.email, u.first_name, u.last_name, u.is_active,
            u.created_at, u.updated_at, r.name AS role
     FROM users u
     JOIN roles r ON r.role_id = u.role_id
     ${whereClause}
     ORDER BY ${sortField} ${sortDirection}
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, pageSize, offset]
  );

  res.json({
    data: userResult.rows,
    pagination: buildPaginationMeta(page, pageSize, countResult.rows[0].total),
  });
});

export const getUser = asyncHandler(async (req, res) => {
  const userResult = await pool.query(
    `SELECT u.user_id AS id, u.email, u.first_name, u.last_name, u.is_active,
            u.created_at, u.updated_at, r.name AS role
     FROM users u
     JOIN roles r ON r.role_id = u.role_id
     WHERE u.user_id = $1`,
    [req.params.id]
  );

  if (userResult.rows.length === 0) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json({ user: userResult.rows[0] });
});

const fetchRoleId = async (roleName) => {
  const roleRes = await pool.query(
    `SELECT role_id FROM roles WHERE name = $1`,
    [roleName]
  );
  return roleRes.rows[0]?.role_id;
};

export const createUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, roleName } = req.body;

  if (!firstName || !lastName || !email || !password || !roleName) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const roleId = await fetchRoleId(roleName);
  if (!roleId) {
    return res.status(400).json({ message: "Role not found" });
  }

  const existing = await pool.query(`SELECT 1 FROM users WHERE email = $1`, [
    email.toLowerCase(),
  ]);
  if (existing.rows.length > 0) {
    return res.status(400).json({ message: "User already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userResult = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, now(), now())
     RETURNING user_id AS id, email, first_name, last_name, role_id, is_active, created_at, updated_at`,
    [email.toLowerCase(), passwordHash, firstName, lastName, roleId]
  );

  res.status(201).json({ user: { ...userResult.rows[0], role: roleName } });
});

const ensureMoreThanOneAdmin = async (client, excludingUserId) => {
  const result = await client.query(
    `SELECT COUNT(*)::int AS total FROM users u
     JOIN roles r ON r.role_id = u.role_id
     WHERE r.name = 'Administrator' AND u.user_id <> $1 AND u.is_active = true`,
    [excludingUserId]
  );
  return result.rows[0].total > 0;
};

export const updateUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, roleName, isActive } = req.body;
  const targetUserId = req.params.id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existingUser = await client.query(
      `SELECT u.user_id, u.email, u.is_active, r.name AS role
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
       WHERE u.user_id = $1`,
      [targetUserId]
    );
    if (existingUser.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User not found" });
    }

    const userRow = existingUser.rows[0];

    if (req.user.id === targetUserId && roleName && roleName !== userRow.role) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Cannot change own role" });
    }

    if (
      userRow.role === "Administrator" &&
      ((typeof isActive !== "undefined" && isActive === false) ||
        (roleName && roleName !== "Administrator"))
    ) {
      const hasAnotherAdmin = await ensureMoreThanOneAdmin(
        client,
        targetUserId
      );
      if (!hasAnotherAdmin) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ message: "At least one Administrator must remain active" });
      }
    }

    let newRoleId = null;
    if (roleName) {
      const roleId = await fetchRoleId(roleName);
      if (!roleId) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Role not found" });
      }
      newRoleId = roleId;
    }

    const updates = [];
    const params = [];
    let idx = 1;

    if (firstName) {
      updates.push(`first_name = $${idx}`);
      params.push(firstName);
      idx += 1;
    }
    if (lastName) {
      updates.push(`last_name = $${idx}`);
      params.push(lastName);
      idx += 1;
    }
    if (newRoleId) {
      updates.push(`role_id = $${idx}`);
      params.push(newRoleId);
      idx += 1;
    }
    if (typeof isActive !== "undefined") {
      updates.push(`is_active = $${idx}`);
      params.push(isActive);
      idx += 1;
    }

    if (updates.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "No fields to update" });
    }

    updates.push(`updated_at = now()`);
    params.push(targetUserId);

    await client.query(
      `UPDATE users SET ${updates.join(", ")} WHERE user_id = $${idx}`,
      params
    );

    await client.query("COMMIT");

    const updatedUser = await pool.query(
      `SELECT u.user_id AS id, u.email, u.first_name, u.last_name, u.is_active, r.name AS role
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
       WHERE u.user_id = $1`,
      [targetUserId]
    );

    res.json({ user: updatedUser.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export const deleteUser = asyncHandler(async (req, res) => {
  const targetUserId = req.params.id;
  if (req.user.id === targetUserId) {
    return res.status(400).json({ message: "Cannot deactivate yourself" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const userResult = await client.query(
      `SELECT u.user_id, u.is_active, r.name AS role
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
       WHERE u.user_id = $1`,
      [targetUserId]
    );

    if (userResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User not found" });
    }

    const userRow = userResult.rows[0];

    if (userRow.role === "Administrator") {
      const hasAnotherAdmin = await ensureMoreThanOneAdmin(
        client,
        targetUserId
      );
      if (!hasAnotherAdmin) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ message: "At least one Administrator must remain active" });
      }
    }

    await client.query(
      `UPDATE users SET is_active = false, updated_at = now() WHERE user_id = $1`,
      [targetUserId]
    );

    await client.query("COMMIT");
    res.status(204).end();
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export default { listUsers, getUser, createUser, updateUser, deleteUser };
