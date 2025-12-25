import express from "express";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import { documentUpload } from "../middleware/upload.js";
import {
  listDocuments,
  listDocumentCategories,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
} from "../controllers/documentController.js";

const router = express.Router();

router.use(protect);

router.get("/", authorize("documents", "read"), listDocuments);
router.get(
  "/categories",
  authorize("documents", "read"),
  listDocumentCategories
);
router.post(
  "/",
  authorize("documents", "create"),
  documentUpload.single("file"),
  createDocument
);
router.get("/:id", authorize("documents", "read"), getDocument);
router.patch(
  "/:id",
  authorize("documents", "update"),
  documentUpload.single("file"),
  updateDocument
);
router.delete("/:id", authorize("documents", "delete"), deleteDocument);

export default router;
