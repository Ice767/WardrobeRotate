import {Router} from "express";

import {login, logout, me, register} from "../controllers/auth.controller";
import {authMiddleware} from "../middlewares/auth.middleware";
import {validateBody} from "../middlewares/validate.middleware";
import {loginUserSchema, registerUserSchema} from "../validators/auth.validator";

const router = Router();

router.post("/register", validateBody(registerUserSchema), register);
router.post("/login", validateBody(loginUserSchema), login);
router.post("/logout", logout);
router.get("/me", authMiddleware, me);

export default router;
