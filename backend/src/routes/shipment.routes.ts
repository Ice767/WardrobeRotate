import {Router} from "express";

import {
    bookShipment,
    changeStatus,
    getShipment,
    listShipments,
    trackShipment,
} from "../controllers/shipment.controller";
import {authMiddleware, requireRole} from "../middlewares/auth.middleware";
import {validateBody, validateParams, validateQuery} from "../middlewares/validate.middleware";
import {
    bookShipmentSchema,
    changeStatusSchema,
    listShipmentsQuerySchema,
    shipmentIdParamSchema,
    trackingCodeParamSchema,
} from "../validators/shipment.validator";

export const trackingRouter = Router();

// Public, like a courier's tracking page: the code itself is the credential.
trackingRouter.get("/:trackingCode", validateParams(trackingCodeParamSchema), trackShipment);

const router = Router();

router.use(authMiddleware);

router.get("/", validateQuery(listShipmentsQuerySchema), listShipments);
router.post("/", requireRole("CLIENT"), validateBody(bookShipmentSchema), bookShipment);
router.get("/:shipmentId", validateParams(shipmentIdParamSchema), getShipment);
// Which role may make which move is the state machine's call, not the route's.
router.post(
    "/:shipmentId/status",
    validateParams(shipmentIdParamSchema),
    validateBody(changeStatusSchema),
    changeStatus,
);

export default router;
