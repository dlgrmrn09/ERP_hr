import fs from "fs";
import path from "path";

const uploadRoot = path.resolve(process.cwd(), "uploads");

export const ensureUploadDir = (relativePath) => {
  const targetPath = path.join(uploadRoot, relativePath);
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
  return targetPath;
};

export const initializeUploadStorage = () => {
  ensureUploadDir("documents");
  ensureUploadDir("cvs");
};

export const resolveFileUrl = (subDir, filename) => {
  const normalized = filename.replace(/\\/g, "/");
  return `/uploads/${subDir}/${normalized}`;
};

export const getUploadRoot = () => uploadRoot;

export default {
  ensureUploadDir,
  initializeUploadStorage,
  resolveFileUrl,
  getUploadRoot,
};
