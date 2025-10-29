import { Router } from "express";
import { assignAdminRole, deleteUser, login, register, revokeAdminRole } from "../controllers/user.controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();


router.post("/register", register);
router.post("/login", login);
router.delete("/:id", deleteUser);

router.post('/assign-admin', authenticate, requireAdmin, assignAdminRole);
router.post('/revoke-admin', authenticate, requireAdmin, revokeAdminRole);

export default router;