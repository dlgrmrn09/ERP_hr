import express from "express";
import { protect } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import {
  createSalary,
  updateSalary,
  getSummarySalary,
} from "../controllers/salaryController";

const router = express.Router();

router.use(protect);

router.post("/", authorize("employees", "manage"), createSalary);
router.patch("/:id", authorize("employees", "manage"), updateSalary);
router.get("/summary/salary", authorize("employees", "read"), getSummarySalary);
export default router;
