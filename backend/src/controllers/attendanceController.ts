import pool from "../config/db";
import { asyncHandler } from "../utils/asyncHandler";
import { parsePagination, buildPaginationMeta } from "../utils/pagination";



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
  getAggregates,
  refreshAggregates,
};
