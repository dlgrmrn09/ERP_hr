import express from "express";
import { protect } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import { getSummary } from "../controllers/dashboardController";

const router = express.Router();

router.use(protect);

router.get("/summary", authorize("dashboard", "read"), getSummary);

export default router;
