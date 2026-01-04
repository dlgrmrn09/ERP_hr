import { Request, Response, CookieOptions } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/db";
import { asyncHandler } from "../utils/asyncHandler";

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env["NODE_ENV"] === "production",
  sameSite: "strict",
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

const generateToken = (id: number | string): string =>
  jwt.sign({ id }, process.env["JWT_SECRET"] as string, { expiresIn: "30d" });

const fetchRoleId = async (roleName: string): Promise<number | undefined> => {
  const result = await pool.query(`SELECT role_id FROM roles WHERE name = $1`, [
    roleName,
  ]);
  return result.rows[0]?.role_id;
};

type RegisterArgs = {
  req: Request;
  res: Response;
  roleName: string;
  unique: boolean;
  successStatus?: number;
};

const registerForRole = async ({
  req,
  res,
  roleName,
  unique,
  successStatus = 201,
}: RegisterArgs) => {
  const { firstName, lastName, email, password } = req.body as {
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
  };

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const roleId = await fetchRoleId(roleName);
  if (!roleId) {
    return res.status(500).json({ message: `${roleName} role missing` });
  }

  if (unique) {
    const existingCount = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
       WHERE r.name = $1`,
      [roleName]
    );
    if (existingCount.rows[0].total > 0) {
      return res
        .status(409)
        .json({ message: `${roleName} already registered` });
    }
  }

  const existingUser = await pool.query(
    `SELECT 1 FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );
  if (existingUser.rows.length > 0) {
    return res.status(400).json({ message: "User already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userResult = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role_id)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING user_id, email, first_name, last_name`,
    [email.toLowerCase(), passwordHash, firstName, lastName, roleId]
  );

  const token = generateToken(userResult.rows[0].user_id);
  res.cookie("token", token, cookieOptions);
  return res.status(successStatus).json({
    user: {
      id: userResult.rows[0].user_id,
      email: userResult.rows[0].email,
      firstName: userResult.rows[0].first_name,
      lastName: userResult.rows[0].last_name,
      role: roleName,
    },
  });
};

export const registerBootstrap = asyncHandler(
  async (req: Request, res: Response) => {
    const { firstName, lastName, email, password } = req.body as {
      firstName?: string;
      lastName?: string;
      email?: string;
      password?: string;
    };

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const userCountResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM users`
    );
    if (userCountResult.rows[0].total > 0) {
      return res
        .status(403)
        .json({ message: "Initial registration already completed" });
    }

    const existingUser = await pool.query(
      `SELECT 1 FROM users WHERE email = $1`,
      [email]
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const roleResult = await pool.query(
      `SELECT role_id FROM roles WHERE name = $1`,
      ["Administrator"]
    );
    if (roleResult.rows.length === 0) {
      return res.status(500).json({ message: "Administrator role missing" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING user_id, email, first_name, last_name`,
      [
        email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        roleResult.rows[0].role_id,
      ]
    );

    const token = generateToken(userResult.rows[0].user_id);
    res.cookie("token", token, cookieOptions);
    return res.status(201).json({
      user: {
        id: userResult.rows[0].user_id,
        email: userResult.rows[0].email,
        firstName: userResult.rows[0].first_name,
        lastName: userResult.rows[0].last_name,
        role: "Administrator",
      },
    });
  }
);

export const registerDirector = asyncHandler(
  async (req: Request, res: Response) => {
    await registerForRole({ req, res, roleName: "Director", unique: true });
  }
);

export const registerHR = asyncHandler(async (req: Request, res: Response) => {
  await registerForRole({
    req,
    res,
    roleName: "HR Specialist",
    unique: false,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ message: "Missing credentials" });
  }

  const userResult = await pool.query(
    `SELECT u.user_id, u.email, u.password_hash, u.first_name, u.last_name, u.role_id, r.name AS role_name
     FROM users u
     JOIN roles r ON r.role_id = u.role_id
     WHERE u.email = $1`,
    [email.toLowerCase()]
  );

  if (userResult.rows.length === 0) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const user = userResult.rows[0];
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = generateToken(user.user_id);
  res.cookie("token", token, cookieOptions);
  return res.json({
    user: {
      id: user.user_id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role_name,
    },
  });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  res.json({ user: (req as any).user });
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.cookie("token", "", { ...cookieOptions, maxAge: 1 });
  res.json({ message: "Logged out" });
});

export default {
  registerBootstrap,
  registerDirector,
  registerHR,
  login,
  me,
  logout,
};
