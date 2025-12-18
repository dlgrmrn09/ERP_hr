import express from "express";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import { getSummary } from "../controllers/dashboardController.js";

const router = express.Router();

router.use(protect);

router.get("/summary", authorize("dashboard", "read"), getSummary);

export default router;
