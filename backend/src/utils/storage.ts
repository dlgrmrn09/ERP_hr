import fs from "fs";
import path from "path";

const uploadRoot = path.resolve(process.cwd(), "uploads");

export const ensureUploadDir = (relativePath: string): string => {
  const targetPath = path.join(uploadRoot, relativePath);
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
  return targetPath;
};

export const initializeUploadStorage = (): void => {
  ensureUploadDir("documents");
  ensureUploadDir("cvs");
};

export const resolveFileUrl = (subDir: string, filename: string): string => {
  const normalized = filename.replace(/\\/g, "/");
  return `/uploads/${subDir}/${normalized}`;
};

export const toAbsoluteFileUrl = (
  relativePath: string | null
): string | null => {
  if (!relativePath) return null;
  if (
    relativePath.startsWith("http://") ||
    relativePath.startsWith("https://")
  ) {
    return relativePath;
  }
  const backendUrl =
    process.env["BACKEND_URL"] ||
    `http://localhost:${process.env["PORT"] || 5000}`;
  return `${backendUrl}${
    relativePath.startsWith("/") ? "" : "/"
  }${relativePath}`;
};

export const getUploadRoot = (): string => uploadRoot;

export default {
  ensureUploadDir,
  initializeUploadStorage,
  resolveFileUrl,
  toAbsoluteFileUrl,
  getUploadRoot,
};
