import pool from "../config/db";
import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";

export const getSummary = asyncHandler(async (_req: Request, res: Response) => {
  const [
    employeeTotals,
    documentTotals,
    taskTotals,
    attendanceTotals,
    ageGenderDistribution,
  ] = await Promise.all([
    pool.query(
      `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE employment_status = 'Үндсэн' AND deleted_at IS NULL)::int AS permanent,
       COUNT(*) FILTER (WHERE employment_status = 'Дадлага' AND deleted_at IS NULL)::int AS interns,
       COUNT(*) FILTER (WHERE employment_status = 'Гэрээт' AND deleted_at IS NULL)::int AS contract
     FROM employees
     WHERE deleted_at IS NULL`
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total FROM documents WHERE deleted_at IS NULL`
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'Done' AND deleted_at IS NULL)::int AS done,
            COUNT(*) FILTER (WHERE status = 'Working On It' AND deleted_at IS NULL)::int AS in_progress,
            COUNT(*) FILTER (WHERE status = 'Stuck' AND deleted_at IS NULL)::int AS stuck
       FROM tasks
       WHERE deleted_at IS NULL`
    ),
    pool.query(
      `SELECT
       COUNT(*) FILTER (WHERE status = 'Late')::int AS total_late,
       COUNT(*) FILTER (WHERE status = 'Absent')::int AS total_absent,
       COALESCE(SUM(overtime_minutes), 0)::int AS total_overtime_minutes
     FROM attendance_records`
    ),
    pool.query(
      `WITH categorized AS (
         SELECT
           CASE
             WHEN age BETWEEN 18 AND 25 THEN '18-25'
             WHEN age BETWEEN 26 AND 35 THEN '26-35'
             WHEN age BETWEEN 36 AND 45 THEN '36-45'
             WHEN age BETWEEN 46 AND 55 THEN '46-55'
             WHEN age >= 56 THEN '56+'
             ELSE 'Тодорхойгүй'
           END AS label,
           CASE
             WHEN age BETWEEN 18 AND 25 THEN 1
             WHEN age BETWEEN 26 AND 35 THEN 2
             WHEN age BETWEEN 36 AND 45 THEN 3
             WHEN age BETWEEN 46 AND 55 THEN 4
             WHEN age >= 56 THEN 5
             ELSE 6
           END AS sort_order,
           LOWER(TRIM(gender)) AS gender
         FROM employees
         WHERE deleted_at IS NULL
       )
       SELECT
         label,
         sort_order,
         COUNT(*) FILTER (WHERE gender IN ('male', 'm', 'эрэгтэй'))::int AS male,
         COUNT(*) FILTER (WHERE gender IN ('female', 'f', 'эмэгтэй'))::int AS female
       FROM categorized
       GROUP BY label, sort_order
       ORDER BY sort_order, label`
    ),
  ]);

  const monthlyAttendance = await pool.query(
    `SELECT to_char(attendance_date, 'YYYY-MM') AS month,
            COUNT(*) FILTER (WHERE status = 'Late')::int AS late,
            COUNT(*) FILTER (WHERE status = 'Absent')::int AS absent
     FROM attendance_records
     WHERE attendance_date >= (CURRENT_DATE - INTERVAL '11 months')
     GROUP BY 1
     ORDER BY 1`
  );

  const dailyAttendance = await pool.query(
    `SELECT attendance_date,
            COUNT(*) FILTER (WHERE status = 'Late')::int AS late,
            COUNT(*) FILTER (WHERE status = 'Absent')::int AS absent,
            COUNT(*) FILTER (WHERE status = 'On Time')::int AS on_time,
            COALESCE(SUM(overtime_minutes), 0)::int AS overtime_minutes
     FROM attendance_records
     WHERE attendance_date = (CURRENT_DATE)
     GROUP BY 1
     ORDER BY 1`
  );

  const recentTasks = await pool.query(
    `SELECT t.task_id AS id, t.title, t.status, t.updated_at, b.name AS board_name
     FROM tasks t
     JOIN boards b ON b.board_id = t.board_id
     WHERE t.deleted_at IS NULL
     ORDER BY t.updated_at DESC
     LIMIT 10`
  );

  res.json({
    employees: {
      total: employeeTotals.rows[0].total,
      permanent: employeeTotals.rows[0].permanent,
      interns: employeeTotals.rows[0].interns,
      contract: employeeTotals.rows[0].contract,
    },
    documents: {
      total: documentTotals.rows[0].total,
    },
    tasks: {
      total: taskTotals.rows[0].total,
      done: taskTotals.rows[0].done,
      inProgress: taskTotals.rows[0].in_progress,
      stuck: taskTotals.rows[0].stuck,
      recent: recentTasks.rows,
    },
    attendance: {
      late: attendanceTotals.rows[0].total_late,
      absent: attendanceTotals.rows[0].total_absent,
      overtimeMinutes: attendanceTotals.rows[0].total_overtime_minutes,
      trend: monthlyAttendance.rows,
      daily: dailyAttendance.rows,
    },
    demographics: {
      ageGender: ageGenderDistribution.rows,
    },
  });
});

export default { getSummary };
