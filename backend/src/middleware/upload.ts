import multer, { FileFilterCallback } from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { Request } from "express";
import { ensureUploadDir } from "../utils/storage";

const pdfMimeType = "application/pdf";
const maxFileSizeBytes = 10 * 1024 * 1024; // 10 MB
const maxImageSizeBytes = 5 * 1024 * 1024; // 5 MB

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

const imageFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  if (!file.mimetype || !file.mimetype.startsWith("image/")) {
    cb(new Error("Зөвхөн зураг (image/*) файл оруулна уу."));
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

const createImageUploader = (subDir: string) =>
  multer({
    storage: buildStorage(subDir),
    fileFilter: imageFileFilter,
    limits: { fileSize: maxImageSizeBytes },
  });

export const documentUpload = createUploader("documents");
export const cvUpload = createUploader("cvs");
export const employeePhotoUpload = createImageUploader("employees");

export default { documentUpload, cvUpload, employeePhotoUpload };
