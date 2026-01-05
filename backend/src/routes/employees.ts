import express from "express";
import { protect } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import { cvUpload } from "../middleware/upload";
import {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "../controllers/employeeController";

const router = express.Router();

router.use(protect);

router.get("/", authorize("employees", "read"), listEmployees);
router.post(
  "/",
  authorize("employees", "create"),
  cvUpload.single("cv"),
  createEmployee
);
router.get("/:id", authorize("employees", "read"), getEmployee);
router.patch(
  "/:id",
  authorize("employees", "update"),
  cvUpload.single("cv"),
  updateEmployee
);
router.delete("/:id", authorize("employees", "delete"), deleteEmployee);

export default router;
