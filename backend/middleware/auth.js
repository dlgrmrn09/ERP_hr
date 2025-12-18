import jwt from "jsonwebtoken";
import pool from "../config/db.js";

const extractToken = (req) => {
  if (req.cookies?.token) {
    return req.cookies.token;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.replace("Bearer ", "");
  }
  return null;
};

export const protect = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userResult = await pool.query(
      `SELECT u.user_id, u.email, u.first_name, u.last_name, u.is_active, u.role_id,
              r.name AS role_name
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
       WHERE u.user_id = $1`,
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ message: "User is inactive" });
    }

    const permissionsResult = await pool.query(
      `SELECT p.module, p.action
       FROM role_permissions rp
       JOIN permissions p ON p.permission_id = rp.permission_id
       WHERE rp.role_id = $1`,
      [user.role_id]
    );

    req.user = {
      id: user.user_id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      roleId: user.role_id,
      roleName: user.role_name,
      permissions: permissionsResult.rows,
    };

    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Not authorized" });
  }
};

export default { protect };
