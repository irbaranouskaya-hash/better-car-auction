import { Router } from "express";
import { assignAdminRole, changePassword, deleteUser, login, logoutAllDevices, refreshTokens, register, revokeAdminRole } from "../controllers/user.controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();


router.post("/register", register);
router.post("/login", login);
router.delete("/:id", authenticate, deleteUser);

router.post('/change-password', authenticate, changePassword);
router.post('/logout-all', authenticate, logoutAllDevices);

router.post('/assign-admin', authenticate, requireAdmin, assignAdminRole);
router.post('/revoke-admin', authenticate, requireAdmin, revokeAdminRole);

router.post("/refresh-token", refreshTokens);

export default router;