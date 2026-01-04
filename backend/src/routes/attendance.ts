import express from "express";
import { protect } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import {
  listAttendance,
  getAttendance,
  createAttendance,
  updateAttendance,
  getAggregates,
  refreshAggregates,
} from "../controllers/attendanceController";

const router = express.Router();

router.use(protect);

router.get("/", authorize("attendance", "read"), listAttendance);
router.post("/", authorize("attendance", "create"), createAttendance);
router.get("/:id", authorize("attendance", "read"), getAttendance);
router.patch("/:id", authorize("attendance", "update"), updateAttendance);
router.get(
  "/aggregates/:employeeId",
  authorize("attendance", "read"),
  getAggregates
);
router.post("/refresh", authorize("attendance", "update"), refreshAggregates);

export default router;
