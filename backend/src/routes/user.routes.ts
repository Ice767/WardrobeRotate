import {Router} from "express";

import {createUser} from "../controllers/user.controller";
import {authMiddleware, requireRole} from "../middlewares/auth.middleware";
import {validateBody} from "../middlewares/validate.middleware";
import {createUserSchema} from "../validators/user.validator";

const router = Router();

// The only way a MANAGER or ADMIN account comes into existence. Public
// registration deliberately cannot reach this path — it always issues CLIENT.
router.post(
    "/",
    authMiddleware,
    requireRole("ADMIN"),
    validateBody(createUserSchema),
    createUser,
);

export default router;
