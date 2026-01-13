import express from "express";
import { protect } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import {
  listAttendance,
  getAttendance,
  getAggregates,
  refreshAggregates,
} from "../controllers/attendanceController";

const router = express.Router();

router.use(protect);

router.get("/", authorize("attendance", "read"), listAttendance);
router.get("/:id", authorize("attendance", "read"), getAttendance);
router.get(
  "/aggregates/:employeeId",
  authorize("attendance", "read"),
  getAggregates
);
router.post("/refresh", authorize("attendance", "update"), refreshAggregates);

export default router;
