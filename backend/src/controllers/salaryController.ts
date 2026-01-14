import { Request, Response } from "express";
import pool from "../config/db";
import { asyncHandler } from "../utils/asyncHandler";

type AuthedRequest = Request & { user?: { id?: number } };

export const createSalary = asyncHandler(
  async (req: AuthedRequest, res: Response) => {
    const {
      employee_id,
      salary_amount,
      kpi,
      salary_bonus,
      overtime,
      penalty,
      salary_first,
      salary_last,
      salary_date_first,
      salary_date_last,
    } = req.body;

    if (!employee_id) {
      return res.status(400).json({ message: "Ажилтаны ID оруулна уу" });
    }

    const result = await pool.query(
      `INSERT INTO salaries (
        employee_id, salary_amount, kpi, salary_bonus, overtime, penalty, 
        salary_first, salary_last, salary_date_first, salary_date_last,
        created_by, updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        employee_id,
        salary_amount,
        kpi,
        salary_bonus,
        overtime,
        penalty,
        salary_first,
        salary_last,
        salary_date_first,
        salary_date_last,
        req.user?.id || null,
        req.user?.id || null,
      ]
    );

    return res.status(201).json({ salary: result.rows[0] });
  }
);

export const updateSalary = asyncHandler(
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const {
      salary_amount,
      kpi,
      salary_bonus,
      overtime,
      penalty,
      salary_first,
      salary_last,
      salary_date_first,
      salary_date_last,
    } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const fields = {
      salary_amount,
      kpi,
      salary_bonus,
      overtime,
      penalty,
      salary_first,
      salary_last,
      salary_date_first,
      salary_date_last,
    };

    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${key} = $${idx}`);
        values.push(value);
        idx++;
      }
    });

    if (updates.length > 0) {
      updates.push(`updated_by = $${idx}`);
      values.push(req.user?.id || null);
      idx++;

      updates.push(`updated_at = now()`);

      values.push(id);

      const result = await pool.query(
        `UPDATE salaries SET ${updates.join(", ")} 
         WHERE salary_id = $${idx} 
         RETURNING *`,
        values
      );

      if (result.rowCount === 0) {
        return res
          .status(404)
          .json({ message: "Цалингийн мэдээлэл олдсонгүй" });
      }

      return res.json({ salary: result.rows[0] });
    }

    return res.status(400).json({ message: "Шинэчлэх мэдээлэл оруулна уу" });
  }
);

export const getSummarySalary = asyncHandler(
  async (_req: Request, res: Response) => {
    const GetAllSalary = await pool.query(`	SELECT e.employee_id AS id,
	       e.employee_code,
	       e.first_name,
	       e.last_name,
	       e.employment_status,
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
	LEFT JOIN LATERAL (
	  SELECT * FROM salaries
	  WHERE employee_id = e.employee_id
	  ORDER BY created_at DESC
	  LIMIT 1
	) s ON true;
`);

    res.json({
      salary: GetAllSalary.rows,
    });
  }
);
