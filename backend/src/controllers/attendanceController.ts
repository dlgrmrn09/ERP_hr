import { Request } from "express";
import pool from "../config/db";
import { asyncHandler } from "../utils/asyncHandler";
import { parsePagination, buildPaginationMeta } from "../utils/pagination";

type AuthedRequest = Request & { user?: { id?: number } };

const attendanceSelect = `
SELECT a.attendance_id AS id,
       a.employee_id,
       e.employee_code,
       e.first_name,
       e.last_name,
       a.attendance_date,
       a.status,
       a.minutes_late,
       a.overtime_minutes,
       a.notes,
       a.created_at,
       a.created_by
FROM attendance_records a
JOIN employees e ON e.employee_id = a.employee_id
`;

const allowedStatuses = new Set(["On Time", "Late", "Absent"]);

type AttendancePayload = {
  employeeId: string;
  attendanceDate: string;
  status: string;
  minutesLate?: number;
  overtimeMinutes?: number;
};

const validateAttendancePayload = ({
  employeeId,
  attendanceDate,
  status,
  minutesLate,
  overtimeMinutes,
}: AttendancePayload): boolean => {
  if (!employeeId || !attendanceDate || !status) {
    return false;
  }
  if (!allowedStatuses.has(status)) {
    return false;
  }
  if (typeof minutesLate !== "undefined" && minutesLate < 0) {
    return false;
  }
  if (typeof overtimeMinutes !== "undefined" && overtimeMinutes < 0) {
    return false;
  }
  return true;
};

export const listAttendance = asyncHandler(async (req, res) => {
  const { employeeId, status, dateFrom, dateTo, month, sort, order } =
    req.query;
  const { page, pageSize, offset } = parsePagination(req.query);

  const filters: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (employeeId) {
    filters.push(`a.employee_id = $${idx}`);
    values.push(employeeId);
    idx += 1;
  }
  if (status) {
    filters.push(`a.status = $${idx}`);
    values.push(status);
    idx += 1;
  }
  if (dateFrom) {
    filters.push(`a.attendance_date >= $${idx}`);
    values.push(dateFrom);
    idx += 1;
  }
  if (dateTo) {
    filters.push(`a.attendance_date <= $${idx}`);
    values.push(dateTo);
    idx += 1;
  }
  if (month) {
    filters.push(
      `date_trunc('month', a.attendance_date) = date_trunc('month', $${idx}::date)`
    );
    values.push(`${month}-01`);
    idx += 1;
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const sortField =
    sort === "minutes_late" ? "a.minutes_late" : "a.attendance_date";
  const sortDirection = order === "asc" ? "ASC" : "DESC";

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM attendance_records a ${whereClause}`,
    values
  );

  const dataResult = await pool.query(
    `${attendanceSelect}
     ${whereClause}
     ORDER BY ${sortField} ${sortDirection}
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, pageSize, offset]
  );

  res.json({
    data: dataResult.rows,
    pagination: buildPaginationMeta(page, pageSize, countResult.rows[0].total),
  });
});

export const getAttendance = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `${attendanceSelect}
     WHERE a.attendance_id = $1`,
    [req.params["id"]]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Ирцийн бүртгэл олдсонгүй" });
  }

  return res.json({ attendance: result.rows[0] });
});

export const createAttendance = asyncHandler(
  async (req: AuthedRequest, res) => {
    const {
      employeeId,
      attendanceDate,
      status,
      minutesLate = 0,
      overtimeMinutes = 0,
      notes,
    } = req.body;

    const minutesLateValue = Number(minutesLate ?? 0);
    const overtimeMinutesValue = Number(overtimeMinutes ?? 0);

    if (
      Number.isNaN(minutesLateValue) ||
      Number.isNaN(overtimeMinutesValue) ||
      !validateAttendancePayload({
        employeeId,
        attendanceDate,
        status,
        minutesLate: minutesLateValue,
        overtimeMinutes: overtimeMinutesValue,
      })
    ) {
      return res.status(400).json({ message: "Ирцийн бүртгэлийн мэдээлэл буруу байна" });
    }

    const employeeExists = await pool.query(
      `SELECT 1 FROM employees WHERE employee_id = $1 AND deleted_at IS NULL`,
      [employeeId]
    );
    if (employeeExists.rows.length === 0) {
      return res.status(400).json({ message: "Ажилтан олдсонгүй" });
    }

    const existingRecord = await pool.query(
      `SELECT attendance_id FROM attendance_records WHERE employee_id = $1 AND attendance_date = $2`,
      [employeeId, attendanceDate]
    );
    if (existingRecord.rows.length > 0) {
      return res
        .status(400)
        .json({ message: "Ирцийн бүртгэл энэ өдөрт аль хэдийн бүртгэгдсэн байна" });
    }

    const insertResult = await pool.query(
      `INSERT INTO attendance_records (
       employee_id, attendance_date, status, minutes_late, overtime_minutes, notes, created_by
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING attendance_id AS id`,
      [
        employeeId,
        attendanceDate,
        status,
        minutesLateValue,
        overtimeMinutesValue,
        notes,
        req.user?.id || null,
      ]
    );

    const record = await pool.query(
      `${attendanceSelect}
     WHERE a.attendance_id = $1`,
      [insertResult.rows[0].id]
    );

    return res.status(201).json({ attendance: record.rows[0] });
  }
);

export const updateAttendance = asyncHandler(async (req, res) => {
  const { status, minutesLate, overtimeMinutes, notes } = req.body;
  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (status) {
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    updates.push(`status = $${idx}`);
    values.push(status);
    idx += 1;
  }
  if (typeof minutesLate !== "undefined") {
    const minutesLateValue = Number(minutesLate);
    if (Number.isNaN(minutesLateValue) || minutesLateValue < 0) {
      return res
        .status(400)
        .json({ message: "minutesLate cannot be negative" });
    }
    updates.push(`minutes_late = $${idx}`);
    values.push(minutesLateValue);
    idx += 1;
  }
  if (typeof overtimeMinutes !== "undefined") {
    const overtimeMinutesValue = Number(overtimeMinutes);
    if (Number.isNaN(overtimeMinutesValue) || overtimeMinutesValue < 0) {
      return res
        .status(400)
        .json({ message: "Илүү цагийн минут сөрөг утгатай байж болохгүй" });
    }
    updates.push(`overtime_minutes = $${idx}`);
    values.push(overtimeMinutesValue);
    idx += 1;
  }
  if (typeof notes !== "undefined") {
    updates.push(`notes = $${idx}`);
    values.push(notes);
    idx += 1;
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: "Шинэчлэх мэдээлэлээ оруулна уу" });
  }

  values.push(req.params["id"]);

  const result = await pool.query(
    `UPDATE attendance_records SET ${updates.join(", ")}
     WHERE attendance_id = $${idx}
     RETURNING attendance_id AS id`,
    values
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Ирцийн бүртгэл олдсонгүй" });
  }

  const record = await pool.query(
    `${attendanceSelect}
     WHERE a.attendance_id = $1`,
    [result.rows[0].id]
  );

  return res.json({ attendance: record.rows[0] });
});

export const getAggregates = asyncHandler(async (req, res) => {
  const employeeId = req.params["employeeId"];
  const aggregate = await pool.query(
    `SELECT employee_id, total_late, total_absent, total_overtime_minutes
     FROM attendance_employee_aggregates
     WHERE employee_id = $1`,
    [employeeId]
  );

  if (aggregate.rows.length === 0) {
    return res.json({
      employeeId,
      totalLate: 0,
      totalAbsent: 0,
      totalOvertimeMinutes: 0,
    });
  }

  const row = aggregate.rows[0];
  return res.json({
    employeeId: row.employee_id,
    totalLate: row.total_late,
    totalAbsent: row.total_absent,
    totalOvertimeMinutes: row.total_overtime_minutes,
  });
});

export const refreshAggregates = asyncHandler(async (_req, res) => {
  res.json({ message: "Ирцийн нийлбэрүүд автоматаар шинэчлэгддэг" });
});

export default {
  listAttendance,
  getAttendance,
  createAttendance,
  updateAttendance,
  getAggregates,
  refreshAggregates,
};
