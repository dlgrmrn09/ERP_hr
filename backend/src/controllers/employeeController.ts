import { Request, Response } from "express";
import pool from "../config/db";
import { asyncHandler } from "../utils/asyncHandler";
import { parsePagination, buildPaginationMeta } from "../utils/pagination";
import { resolveFileUrl, toAbsoluteFileUrl } from "../utils/storage";

type AuthedRequest = Request & { user?: { id?: number } };

type ListQuery = {
  search?: string | undefined;
  status?: string | undefined;
  position?: string | undefined;
  startDateFrom?: string | undefined;
  startDateTo?: string | undefined;
  sort?: string | undefined;
  order?: string | undefined;
};

type FilterParams = Pick<
  ListQuery,
  "search" | "status" | "position" | "startDateFrom" | "startDateTo"
>;

type EmployeePayloadInput = {
  employeeCode?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  positionTitle?: string;
  employmentStatus?: string;
  gender?: string;
  age?: string | number | null;
  startDate?: string;
  cvUrl?: string;
};

const allowedSort = {
  last_name: "e.last_name",
  first_name: "e.first_name",
  start_date: "e.start_date",
  employment_status: "e.employment_status",
  created_at: "e.created_at",
} as const;

type AllowedSortKey = keyof typeof allowedSort;

const resolveSortField = (sort?: string): string => {
  const key = sort as AllowedSortKey;
  return allowedSort[key] ?? allowedSort.last_name;
};

const baseSelect = `
SELECT e.employee_id AS id,
       e.employee_code,
       e.first_name,
       e.last_name,
       e.email,
       e.phone_number,
       e.position_title,
       e.employment_status,
       e.gender,
       e.age,
       e.start_date,
       e.years_of_service,
       e.cv_url,
       e.photo_url,
       e.created_at,
       e.updated_at,
       COALESCE(agg.total_late, 0) AS total_late,
       COALESCE(agg.total_absent, 0) AS total_absent,
       COALESCE(agg.total_overtime_minutes, 0) AS total_overtime_minutes,
       s.salary_id,
       s.salary_amount,
       s.kpi,
       s.salary_bonus,
       s.overtime AS salary_overtime,
       s.penalty,
       s.salary_first,
       s.salary_last,
       s.salary_date_first,
       s.salary_date_last
FROM employees e
LEFT JOIN attendance_employee_aggregates agg ON agg.employee_id = e.employee_id
LEFT JOIN LATERAL (
  SELECT * FROM salaries
  WHERE employee_id = e.employee_id
  ORDER BY created_at DESC
  LIMIT 1
) s ON true
`;

const mapEmployee = (row: any) => ({
  ...row,
  cv_url: toAbsoluteFileUrl(row?.cv_url ?? null),
  photo_url: toAbsoluteFileUrl(row?.photo_url ?? null),
});

const buildFilters = ({
  search,
  status,
  position,
  startDateFrom,
  startDateTo,
}: FilterParams) => {
  const filters: string[] = ["e.deleted_at IS NULL"];
  const values: Array<string> = [];
  let idx = 1;

  if (search) {
    filters.push(
      `(e.first_name ILIKE $${idx} OR e.last_name ILIKE $${idx} OR e.employee_code ILIKE $${idx} OR e.email ILIKE $${idx} OR e.position_title ILIKE $${idx} OR e.phone_number ILIKE $${idx})`
    );
    values.push(`%${search}%`);
    idx += 1;
  }
  if (status) {
    filters.push(`e.employment_status = $${idx}`);
    values.push(status);
    idx += 1;
  }
  if (position) {
    filters.push(`e.position_title ILIKE $${idx}`);
    values.push(`%${position}%`);
    idx += 1;
  }
  if (startDateFrom) {
    filters.push(`e.start_date >= $${idx}`);
    values.push(startDateFrom);
    idx += 1;
  }
  if (startDateTo) {
    filters.push(`e.start_date <= $${idx}`);
    values.push(startDateTo);
    idx += 1;
  }

  return {
    whereClause: `WHERE ${filters.join(" AND ")}`,
    values,
    nextIndex: idx,
  };
};

export const listEmployees = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      search,
      status,
      position,
      startDateFrom,
      startDateTo,
      sort,
      order,
    } = req.query as ListQuery;
    const { page, pageSize, offset } = parsePagination(req.query);

    const { whereClause, values, nextIndex } = buildFilters({
      search,
      status,
      position,
      startDateFrom,
      startDateTo,
    });

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM employees e ${whereClause}`,
      values
    );

    const sortField = resolveSortField(sort);
    const sortDirection = order === "desc" ? "DESC" : "ASC";

    const dataResult = await pool.query(
      `${baseSelect}
     ${whereClause}
     ORDER BY ${sortField} ${sortDirection}
     LIMIT $${nextIndex} OFFSET $${nextIndex + 1}`,
      [...values, pageSize, offset]
    );

    res.json({
      data: dataResult.rows.map(mapEmployee),
      pagination: buildPaginationMeta(
        page,
        pageSize,
        countResult.rows[0].total
      ),
    });
  }
);

export const getEmployee = asyncHandler(async (req: Request, res: Response) => {
  const employeeResult = await pool.query(
    `${baseSelect}
     WHERE e.employee_id = $1 AND e.deleted_at IS NULL`,
    [req.params["id"]]
  );

  if (employeeResult.rows.length === 0) {
    return res.status(404).json({ message: "Ажилтан олдсонгүй" });
  }

  return res.json({ employee: mapEmployee(employeeResult.rows[0]) });
});

const requiredEmployeeFields = [
  "employeeCode",
  "firstName",
  "lastName",
  "email",
  "positionTitle",
  "employmentStatus",
] as const;

const normalizeOptional = (value: unknown) => {
  if (typeof value === "undefined" || value === null || value === "") {
    return null;
  }
  return value as string;
};

const isValidEightDigitPhone = (value: unknown) => {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  return /^\d{8}$/.test(trimmed);
};

const parseNullableInteger = (value: unknown) => {
  if (value === "" || typeof value === "undefined" || value === null) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.trunc(parsed);
};

const normalizeGender = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

const mapEmployeePayload = (payload: EmployeePayloadInput = {}) => {
  const normalizedPhone = normalizeOptional(payload?.phoneNumber);
  const sanitizedPhone =
    typeof normalizedPhone === "string"
      ? normalizedPhone.trim()
      : normalizedPhone;

  return {
    employee_code: payload?.employeeCode,
    first_name: payload?.firstName,
    last_name: payload?.lastName,
    email: payload?.email?.toLowerCase(),
    phone_number: sanitizedPhone,
    position_title: normalizeOptional(payload?.positionTitle),
    employment_status: payload?.employmentStatus,
    gender: normalizeGender(payload?.gender),
    age: parseNullableInteger(payload?.age),
    start_date: normalizeOptional(payload?.startDate),
    cv_url: normalizeOptional(payload?.cvUrl),
  };
};

export const createEmployee = asyncHandler(
  async (req: AuthedRequest, res: Response) => {
    const uploadedCv = (req as AuthedRequest).file;
    const body = (req.body ?? {}) as any;
    const missingField = requiredEmployeeFields.find((field) => !body[field]);
    if (missingField) {
      return res
        .status(400)
        .json({ message: `Мэдээлэл дутуу байна: ${missingField}` });
    }

    const payload = mapEmployeePayload(req.body);
    const finalCvUrl = uploadedCv
      ? resolveFileUrl("cvs", uploadedCv.filename)
      : payload.cv_url;

    const existing = await pool.query(
      `SELECT 1 FROM employees WHERE employee_code = $1 OR email = $2`,
      [payload.employee_code, payload.email]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "Ажилтан Бүртгэгдсэн байна" });
    }
    if (!isValidEightDigitPhone(payload.phone_number)) {
      return res.status(400).json({
        message: "Утасны дугаар буруу байна. 8 оронтой тоо оруулна уу.",
      });
    }

    const result = await pool.query(
      `INSERT INTO employees (
       employee_code, first_name, last_name, email, phone_number,
       position_title, employment_status, gender, age, start_date, cv_url,
       created_by, updated_by
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING employee_id AS id`,
      [
        payload.employee_code,
        payload.first_name,
        payload.last_name,
        payload.email,
        payload.phone_number,
        payload.position_title,
        payload.employment_status,
        payload.gender,
        payload.age,
        payload.start_date,
        finalCvUrl,
        req.user?.id || null,
        req.user?.id || null,
      ]
    );

    const employee = await pool.query(
      `${baseSelect}
     WHERE e.employee_id = $1`,
      [result.rows[0].id]
    );

    return res.status(201).json({ employee: mapEmployee(employee.rows[0]) });
  }
);

export const updateEmployee = asyncHandler(
  async (req: AuthedRequest, res: Response) => {
    const uploadedCv = (req as AuthedRequest).file;
    const payload = mapEmployeePayload(req.body);
    const employeeId = req.params["id"];

    if (!employeeId) {
      return res.status(400).json({ message: "Ажилтанын ID Оруулна уу." });
    }

    if (typeof payload.phone_number !== "undefined") {
      if (!isValidEightDigitPhone(payload.phone_number)) {
        return res.status(400).json({
          message: "Утасны дугаар буруу байна.",
        });
      }
    }

    if (payload.employee_code || payload.email) {
      const uniquenessChecks: string[] = [];
      const values: Array<string | number | null> = [];
      let idx = 1;
      if (payload.employee_code) {
        uniquenessChecks.push(`employee_code = $${idx}`);
        values.push(payload.employee_code);
        idx += 1;
      }
      if (payload.email) {
        uniquenessChecks.push(`email = $${idx}`);
        values.push(payload.email);
        idx += 1;
      }
      if (uniquenessChecks.length > 0) {
        values.push(employeeId);
        const duplicate = await pool.query(
          `SELECT 1 FROM employees WHERE (${uniquenessChecks.join(
            " OR "
          )}) AND employee_id <> $${idx}`,
          values
        );
        if (duplicate.rows.length > 0) {
          return res.status(400).json({
            message: "Ажилтанын код эсвэл имэйл давхардсан байна",
          });
        }
      }
    }
    const updates: string[] = [];
    const values: Array<string | number | null> = [];
    let idx = 1;

    Object.entries(payload).forEach(([key, value]) => {
      if (key === "cv_url") {
        return;
      }
      if (typeof value !== "undefined" && value !== null) {
        updates.push(`${key} = $${idx}`);
        values.push(value);
        idx += 1;
      }
    });

    if (uploadedCv) {
      updates.push(`cv_url = $${idx}`);
      values.push(resolveFileUrl("cvs", uploadedCv.filename));
      idx += 1;
    } else if (typeof payload.cv_url !== "undefined") {
      updates.push(`cv_url = $${idx}`);
      values.push(payload.cv_url);
      idx += 1;
    }

    if (updates.length === 0) {
      return res
        .status(400)
        .json({ message: "Шинэчлэх мэдээлэлээ оруулна уу" });
    }

    updates.push(`updated_by = $${idx}`);
    values.push(req.user?.id || null);
    idx += 1;

    updates.push(`updated_at = now()`);

    values.push(employeeId);

    const result = await pool.query(
      `UPDATE employees SET ${updates.join(", ")}
     WHERE employee_id = $${idx}
       AND deleted_at IS NULL
     RETURNING employee_id AS id`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Ажилтан олдсонгүй" });
    }

    const employee = await pool.query(
      `${baseSelect}
     WHERE e.employee_id = $1`,
      [result.rows[0].id]
    );

    return res.json({ employee: mapEmployee(employee.rows[0]) });
  }
);

export const deleteEmployee = asyncHandler(
  async (req: AuthedRequest, res: Response) => {
    const result = await pool.query(
      `UPDATE employees
     SET deleted_at = now(), updated_by = $2, updated_at = now()
     WHERE employee_id = $1 AND deleted_at IS NULL`,
      [req.params["id"], req.user?.["id"] || null]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Ажилтан олдсонгүй" });
    }

    return res.status(204).end();
  }
);

export const updateEmployeePhoto = asyncHandler(
  async (req: AuthedRequest, res: Response) => {
    const employeeId = req.params["id"];
    const uploadedPhoto = (req as AuthedRequest).file;

    if (!employeeId) {
      return res.status(400).json({ message: "Ажилтанын ID Оруулна уу." });
    }

    if (!uploadedPhoto) {
      return res.status(400).json({ message: "Зургийн файл оруулна уу." });
    }

    const photoUrl = resolveFileUrl("employees", uploadedPhoto.filename);

    const result = await pool.query(
      `UPDATE employees
       SET photo_url = $1, updated_by = $3, updated_at = now()
       WHERE employee_id = $2 AND deleted_at IS NULL
       RETURNING employee_id AS id`,
      [photoUrl, employeeId, req.user?.id || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Ажилтан олдсонгүй" });
    }

    const employee = await pool.query(
      `${baseSelect}
       WHERE e.employee_id = $1`,
      [result.rows[0].id]
    );

    return res.json({ employee: mapEmployee(employee.rows[0]) });
  }
);

export default {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  updateEmployeePhoto,
  deleteEmployee,
};
