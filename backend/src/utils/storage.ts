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

export const getUploadRoot = (): string => uploadRoot;

export default {
  ensureUploadDir,
  initializeUploadStorage,
  resolveFileUrl,
  getUploadRoot,
};
