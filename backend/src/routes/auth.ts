import express from "express";
import { protect } from "../middleware/auth";
import {
  registerBootstrap,
  registerDirector,
  registerHR,
  login,
  me,
  logout,
} from "../controllers/authController";

const router = express.Router();

router.post("/bootstrap", registerBootstrap);
router.post("/register/director", registerDirector);
router.post("/register/hr", registerHR);
router.post("/login", login);
router.get("/me", protect, me);
router.post("/logout", protect, logout);

export default router;
