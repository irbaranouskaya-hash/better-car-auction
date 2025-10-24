import { Router } from "express";
import { deleteUser, login, register } from "../controllers/user.controller.js";

const router = Router();


router.post("/register", register);
router.post("/login", login);
router.delete("/:id", deleteUser);

export default router;