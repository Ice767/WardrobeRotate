import {Router} from "express";

import {
    createTariff,
    deleteTariff,
    getTariff,
    listTariffs,
    updateTariff,
} from "../controllers/tariff.controller";
import {authMiddleware, requireRole} from "../middlewares/auth.middleware";
import {validateBody, validateParams, validateQuery} from "../middlewares/validate.middleware";
import {
    createTariffSchema,
    listTariffsQuerySchema,
    tariffIdParamSchema,
    updateTariffSchema,
} from "../validators/tariff.validator";

const router = Router();

// The raw matrix is a carrier's commercial data. Clients will see prices only
// through the quote calculator, never by browsing competitors' rate cards.
router.use(authMiddleware, requireRole("MANAGER", "ADMIN"));

router.get("/", validateQuery(listTariffsQuerySchema), listTariffs);
router.post("/", validateBody(createTariffSchema), createTariff);
router.get("/:tariffId", validateParams(tariffIdParamSchema), getTariff);
router.patch(
    "/:tariffId",
    validateParams(tariffIdParamSchema),
    validateBody(updateTariffSchema),
    updateTariff,
);
router.delete("/:tariffId", validateParams(tariffIdParamSchema), deleteTariff);

export default router;
