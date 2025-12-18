import express from "express";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "../controllers/employeeController.js";

const router = express.Router();

router.use(protect);

router.get("/", authorize("employees", "read"), listEmployees);
router.post("/", authorize("employees", "create"), createEmployee);
router.get("/:id", authorize("employees", "read"), getEmployee);
router.patch("/:id", authorize("employees", "update"), updateEmployee);
router.delete("/:id", authorize("employees", "delete"), deleteEmployee);

export default router;
