import {Router} from "express";

import {
    getCarrier,
    getRegion,
    listCarriers,
    listRegions,
    listTransportTypes,
} from "../controllers/reference.controller";
import {validateParams, validateQuery} from "../middlewares/validate.middleware";
import {
    carrierIdParamSchema,
    listCarriersQuerySchema,
    listRegionsQuerySchema,
    regionIdParamSchema,
} from "../validators/reference.validator";

const router = Router();

// Reference data is readable by anyone: the quote form has to populate before
// login, and there is nothing secret in a list of cities.
router.get("/regions", validateQuery(listRegionsQuerySchema), listRegions);
router.get("/regions/:regionId", validateParams(regionIdParamSchema), getRegion);

router.get("/transport-types", listTransportTypes);

router.get("/carriers", validateQuery(listCarriersQuerySchema), listCarriers);
router.get("/carriers/:carrierId", validateParams(carrierIdParamSchema), getCarrier);

export default router;
