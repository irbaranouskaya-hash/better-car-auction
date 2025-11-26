import { Router } from "express";
import { 
  assignAdminRole, 
  changePassword, 
  deleteUser, 
  getActiveSessions, 
  login, 
  logout, 
  logoutAllDevices, 
  refreshTokens, 
  register, 
  revokeAdminRole 
} from "../controllers/user.controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);

router.post("/refresh-token", authenticate, refreshTokens);
router.post("/logout", authenticate, logout);
router.post('/logout-all', authenticate, logoutAllDevices);
router.get('/sessions', authenticate, getActiveSessions);

router.post('/change-password', authenticate, changePassword);
router.delete("/:id", authenticate, deleteUser);

router.post('/assign-admin', authenticate, requireAdmin, assignAdminRole);
router.post('/revoke-admin', authenticate, requireAdmin, revokeAdminRole);

export default router;