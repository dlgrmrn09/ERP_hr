import type { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import pool from "../config/db";

export type PermissionRow = { module: string; action: string };
type UserRow = {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  role_id: number;
  role_name: string;
};

interface TokenPayload extends JwtPayload {
  id: string;
}

const extractToken = (req: Request): string | null => {
  if (req.cookies?.["token"]) {
    return req.cookies["token"];
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.replace("Bearer ", "");
  }
  return null;
};

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ message: "Not authorized" });
      return;
    }

    const jwtSecret = process.env["JWT_SECRET"];
    if (!jwtSecret) {
      console.error("JWT secret is not configured");
      res.status(500).json({ message: "Server misconfiguration" });
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as TokenPayload;
    if (!decoded.id) {
      res.status(401).json({ message: "Not authorized" });
      return;
    }

    const userResult = await pool.query<UserRow>(
      `SELECT u.user_id, u.email, u.first_name, u.last_name, u.is_active, u.role_id,
              r.name AS role_name
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
       WHERE u.user_id = $1`,
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      res.status(401).json({ message: "Not authorized" });
      return;
    }

    const user = userResult.rows[0];
    if (!user?.is_active) {
      res.status(403).json({ message: "User is inactive" });
      return;
    }

    const permissionsResult = await pool.query<PermissionRow>(
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
    if (
      error instanceof jwt.TokenExpiredError ||
      error instanceof jwt.JsonWebTokenError
    ) {
      res.status(401).json({ message: "Not authorized" });
      return;
    }

    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export default { protect };
