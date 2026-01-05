import { Request, Response } from "express";
import pool from "../config/db";
import { asyncHandler } from "../utils/asyncHandler";
import { parsePagination, buildPaginationMeta } from "../utils/pagination";
import { resolveFileUrl, toAbsoluteFileUrl } from "../utils/storage";

type AuthenticatedRequest = Request & { user?: { id: number } };

const baseSelect = `
SELECT d.document_id AS id,
       d.title,
       d.description,
       d.file_url,
       d.file_size_bytes,
       d.uploaded_at,
       d.updated_at,
       c.name AS category,
       d.uploaded_by,
       CONCAT(u.first_name, ' ', u.last_name) AS uploaded_by_name
FROM documents d
JOIN document_categories c ON c.category_id = d.category_id
JOIN users u ON u.user_id = d.uploaded_by
WHERE d.deleted_at IS NULL
`;

export const listDocuments = asyncHandler(
  async (req: Request, res: Response) => {
    const { search, category, sort, order } = req.query;
    const { page, pageSize, offset } = parsePagination(req.query);

    const filters = [];
    const values = [];
    let idx = 1;

    if (search) {
      filters.push(`(d.title ILIKE $${idx} OR d.description ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx += 1;
    }

    if (category) {
      filters.push(`c.name = $${idx}`);
      values.push(category);
      idx += 1;
    }

    const filterSql = filters.length ? ` AND ${filters.join(" AND ")}` : "";
    const sortField = sort === "updated_at" ? "d.updated_at" : "d.uploaded_at";
    const sortDirection = order === "asc" ? "ASC" : "DESC";

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
     FROM documents d
     JOIN document_categories c ON c.category_id = d.category_id
     WHERE d.deleted_at IS NULL${filterSql}`,
      values
    );

    const dataResult = await pool.query(
      `${baseSelect}
     ${filterSql}
     ORDER BY ${sortField} ${sortDirection}
     LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, pageSize, offset]
    );

    const documents = dataResult.rows.map((doc) => ({
      ...doc,
      file_url: toAbsoluteFileUrl(doc.file_url),
    }));

    res.json({
      data: documents,
      pagination: buildPaginationMeta(
        page,
        pageSize,
        countResult.rows[0].total
      ),
    });
  }
);

export const listDocumentCategories = asyncHandler(async (_req, res) => {
  const result = await pool.query(
    `SELECT name FROM document_categories ORDER BY name ASC`
  );

  res.json({ categories: result.rows.map((row) => row.name) });
});

export const getDocument = asyncHandler(async (req: Request, res: Response) => {
  const result = await pool.query(
    `${baseSelect}
     AND d.document_id = $1`,
    [req.params["id"]]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Бичиг баримт олдсонгүй" });
  }

  const doc = result.rows[0];
  return res.json({
    document: { ...doc, file_url: toAbsoluteFileUrl(doc.file_url) },
  });
});

const resolveCategoryId = async (name: string): Promise<number | undefined> => {
  const categoryRes = await pool.query(
    `SELECT category_id FROM document_categories WHERE name = $1`,
    [name]
  );
  return categoryRes.rows[0]?.category_id;
};

export const createDocument = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { title, description, fileUrl, fileSizeBytes, category } = req.body;
    const uploadedFile = req.file;

    const finalFileUrl = uploadedFile
      ? resolveFileUrl("documents", uploadedFile.filename)
      : fileUrl;
    const finalFileSize = uploadedFile ? uploadedFile.size : fileSizeBytes;

    if (!title || !category || !finalFileUrl) {
      return res.status(400).json({ message: "Мэдээлэл дутуу байна" });
    }

    const categoryId = await resolveCategoryId(category);
    if (!categoryId) {
      return res.status(400).json({ message: "Бичиг Баримтны төрөл олдсонгүй" });
    }

    const insertResult = await pool.query(
      `INSERT INTO documents (category_id, title, description, file_url, file_size_bytes, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING document_id AS id`,
      [
        categoryId,
        title,
        description,
        finalFileUrl,
        finalFileSize ?? null,
        req.user?.id,
      ]
    );

    const document = await pool.query(
      `${baseSelect}
     AND d.document_id = $1`,
      [insertResult.rows[0].id]
    );

    const created = document.rows[0];
    return res
      .status(201)
      .json({
        document: { ...created, file_url: toAbsoluteFileUrl(created.file_url) },
      });
  }
);

export const updateDocument = asyncHandler(
  async (req: Request, res: Response) => {
    const { title, description, fileUrl, fileSizeBytes, category } = req.body;
    const uploadedFile = req.file;
    const updates = [];
    const values = [];
    let idx = 1;

    if (title) {
      updates.push(`title = $${idx}`);
      values.push(title);
      idx += 1;
    }
    if (typeof description !== "undefined") {
      updates.push(`description = $${idx}`);
      values.push(description);
      idx += 1;
    }
    if (uploadedFile) {
      updates.push(`file_url = $${idx}`);
      values.push(resolveFileUrl("documents", uploadedFile.filename));
      idx += 1;
      updates.push(`file_size_bytes = $${idx}`);
      values.push(uploadedFile.size);
      idx += 1;
    } else {
      if (fileUrl) {
        updates.push(`file_url = $${idx}`);
        values.push(fileUrl);
        idx += 1;
      }
      if (typeof fileSizeBytes !== "undefined") {
        updates.push(`file_size_bytes = $${idx}`);
        values.push(fileSizeBytes);
        idx += 1;
      }
    }
    if (category) {
      const categoryId = await resolveCategoryId(category);
      if (!categoryId) {
        return res.status(400).json({ message: "Бичиг Баримтны төрөл олдсонгүй" });
      }
      updates.push(`category_id = $${idx}`);
      values.push(categoryId);
      idx += 1;
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "Мэдээлэл дутуу байна" });
    }

    updates.push(`updated_at = now()`);

    values.push(req.params["id"]);

    const result = await pool.query(
      `UPDATE documents SET ${updates.join(", ")}
     WHERE document_id = $${idx} AND deleted_at IS NULL
     RETURNING document_id AS id`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Бичиг баримт олдсонгүй" });
    }

    const document = await pool.query(
      `${baseSelect}
     AND d.document_id = $1`,
      [result.rows[0].id]
    );

    const updated = document.rows[0];
    return res.json({
      document: { ...updated, file_url: toAbsoluteFileUrl(updated.file_url) },
    });
  }
);

export const deleteDocument = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await pool.query(
      `UPDATE documents SET deleted_at = now(), updated_at = now()
     WHERE document_id = $1 AND deleted_at IS NULL`,
      [req.params["id"]]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Бичиг баримт олдсонгүй" });
    }

    return res.status(204).end();
  }
);

export default {
  listDocuments,
  listDocumentCategories,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
};
