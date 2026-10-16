import {Router} from "express";

import {
    acceptQuote,
    cancelRfq,
    createRfq,
    getRfq,
    listRfqs,
    submitQuote,
} from "../controllers/rfq.controller";
import {authMiddleware, requireRole} from "../middlewares/auth.middleware";
import {validateBody, validateParams, validateQuery} from "../middlewares/validate.middleware";
import {
    acceptRfqQuoteSchema,
    createRfqSchema,
    listRfqsQuerySchema,
    rfqIdParamSchema,
    submitRfqQuoteSchema,
} from "../validators/rfq.validator";

const router = Router();

// Unlike instant quotes, an RFQ ties a named client to named carriers, so every
// route needs to know who is asking. Who may see which RFQ is decided in the
// service, per record; the route only gates the action by role.
router.use(authMiddleware);

router.get("/", validateQuery(listRfqsQuerySchema), listRfqs);
router.post("/", requireRole("CLIENT"), validateBody(createRfqSchema), createRfq);
router.get("/:rfqId", validateParams(rfqIdParamSchema), getRfq);
router.post(
    "/:rfqId/quotes",
    requireRole("MANAGER"),
    validateParams(rfqIdParamSchema),
    validateBody(submitRfqQuoteSchema),
    submitQuote,
);
router.post(
    "/:rfqId/accept",
    requireRole("CLIENT"),
    validateParams(rfqIdParamSchema),
    validateBody(acceptRfqQuoteSchema),
    acceptQuote,
);
router.post("/:rfqId/cancel", requireRole("CLIENT"), validateParams(rfqIdParamSchema), cancelRfq);

export default router;
