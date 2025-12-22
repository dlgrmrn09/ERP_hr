import express from "express";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import {
  listTasks,
  getTaskOverview,
  createTask,
  updateTask,
  deleteTask,
  listTaskActivity,
  addTaskActivity,
} from "../controllers/taskController.js";

const router = express.Router();

router.use(protect);

router.get("/overview", authorize("tasks", "read"), getTaskOverview);
router.get("/", authorize("tasks", "read"), listTasks);
router.post("/", authorize("tasks", "create"), createTask);
router.patch("/:id", authorize("tasks", "update"), updateTask);
router.delete("/:id", authorize("tasks", "delete"), deleteTask);
router.get("/:id/activity", authorize("tasks", "read"), listTaskActivity);
router.post("/:id/activity", authorize("tasks", "update"), addTaskActivity);

export default router;
