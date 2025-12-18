import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { ensureUploadDir } from "../utils/storage.js";

const pdfMimeType = "application/pdf";
const maxFileSizeBytes = 10 * 1024 * 1024; // 10 MB

const buildStorage = (subDir) => {
  const destination = ensureUploadDir(subDir);
  return multer.diskStorage({
    destination,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
      const safeName = `${Date.now()}-${randomUUID()}${ext}`;
      cb(null, safeName);
    },
  });
};

const fileFilter = (req, file, cb) => {
  if (file.mimetype !== pdfMimeType) {
    cb(new Error("Only PDF files are allowed"));
    return;
  }
  cb(null, true);
};

const createUploader = (subDir) =>
  multer({
    storage: buildStorage(subDir),
    fileFilter,
    limits: { fileSize: maxFileSizeBytes },
  });

export const documentUpload = createUploader("documents");
export const cvUpload = createUploader("cvs");

export default { documentUpload, cvUpload };
