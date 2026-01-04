import multer, { FileFilterCallback } from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { Request } from "express";
import { ensureUploadDir } from "../utils/storage";

const pdfMimeType = "application/pdf";
const maxFileSizeBytes = 10 * 1024 * 1024; // 10 MB

const buildStorage = (subDir: string) => {
  const destination = ensureUploadDir(subDir);
  return multer.diskStorage({
    destination,
    filename: (_req, file, cb) => {
      const ext = (path.extname(file.originalname) || ".pdf").toLowerCase();
      const safeName = `${Date.now()}-${randomUUID()}${ext}`;
      cb(null, safeName);
    },
  });
};

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  if (file.mimetype !== pdfMimeType) {
    cb(new Error("Зөвхөн PDF файлуудыг оруулна уу."));
    return;
  }
  cb(null, true);
};

const createUploader = (subDir: string) =>
  multer({
    storage: buildStorage(subDir),
    fileFilter,
    limits: { fileSize: maxFileSizeBytes },
  });

export const documentUpload = createUploader("documents");
export const cvUpload = createUploader("cvs");

export default { documentUpload, cvUpload };
