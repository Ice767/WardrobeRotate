import {Router} from "express";

import {login, logout, me, register} from "../controllers/auth.controller";
import {authMiddleware} from "../middlewares/auth.middleware";
import {loginRateLimit, registerRateLimit} from "../middlewares/rate-limit.middleware";
import {validateBody} from "../middlewares/validate.middleware";
import {loginUserSchema, registerUserSchema} from "../validators/auth.validator";

const router = Router();

// The limiter comes first, so rejected and malformed attempts count too.
router.post("/register", registerRateLimit, validateBody(registerUserSchema), register);
router.post("/login", loginRateLimit, validateBody(loginUserSchema), login);
router.post("/logout", logout);
router.get("/me", authMiddleware, me);

export default router;
