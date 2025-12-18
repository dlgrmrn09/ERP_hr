import express from "express";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import {
  listWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
} from "../controllers/taskController.js";

const router = express.Router();

router.use(protect);

router.get("/", authorize("workspaces", "read"), listWorkspaces);
router.post("/", authorize("workspaces", "create"), createWorkspace);
router.patch("/:id", authorize("workspaces", "update"), updateWorkspace);
router.delete("/:id", authorize("workspaces", "delete"), deleteWorkspace);

export default router;
