import pool from "../config/db.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getSummary = asyncHandler(async (req, res) => {
  const [employeeTotals, documentTotals, taskTotals, attendanceTotals] =
    await Promise.all([
      pool.query(
        `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE employment_status = 'Permanent' AND deleted_at IS NULL)::int AS permanent,
         COUNT(*) FILTER (WHERE employment_status = 'Intern' AND deleted_at IS NULL)::int AS interns
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
    },
  });
});

export default { getSummary };
