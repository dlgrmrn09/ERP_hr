import express from "express";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
} from "../controllers/userController.js";

const router = express.Router();

router.use(protect);

router.get("/", authorize("users", "read"), listUsers);
router.post("/", authorize("users", "create"), createUser);
router.get("/:id", authorize("users", "read"), getUser);
router.patch("/:id", authorize("users", "update"), updateUser);
router.delete("/:id", authorize("users", "delete"), deleteUser);

export default router;
