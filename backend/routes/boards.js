import express from "express";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import {
  listBoards,
  getBoard,
  createBoard,
  updateBoard,
  deleteBoard,
  listBoardMembers,
  addBoardMember,
  removeBoardMember,
  listStatusGroups,
  createStatusGroup,
  updateStatusGroup,
  deleteStatusGroup,
} from "../controllers/taskController.js";

const router = express.Router();

router.use(protect);

router.get("/", authorize("boards", "read"), listBoards);
router.get("/:id", authorize("boards", "read"), getBoard);
router.post("/", authorize("boards", "create"), createBoard);
router.patch("/:id", authorize("boards", "update"), updateBoard);
router.delete("/:id", authorize("boards", "delete"), deleteBoard);
router.get("/:id/members", authorize("boards", "read"), listBoardMembers);
router.post("/:id/members", authorize("boards", "update"), addBoardMember);
router.delete(
  "/:id/members/:employeeId",
  authorize("boards", "update"),
  removeBoardMember
);

router.get(
  "/:boardId/status-groups",
  authorize("boards", "read"),
  listStatusGroups
);
router.post(
  "/:boardId/status-groups",
  authorize("boards", "update"),
  createStatusGroup
);
router.patch(
  "/status-groups/:statusGroupId",
  authorize("boards", "update"),
  updateStatusGroup
);
router.delete(
  "/status-groups/:statusGroupId",
  authorize("boards", "delete"),
  deleteStatusGroup
);

export default router;
