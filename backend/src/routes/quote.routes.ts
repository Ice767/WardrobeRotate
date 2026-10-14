import {Router} from "express";

import {createQuotes, listCargoCategories} from "../controllers/quote.controller";
import {validateBody} from "../middlewares/validate.middleware";
import {quoteRequestSchema} from "../validators/quote.validator";

const router = Router();

// Public, like the reference data: a shipper must be able to price a shipment
// before deciding to sign up. This is the one sanctioned window onto tariffs —
// a computed price for a stated shipment, never the matrix itself.
router.get("/cargo-categories", listCargoCategories);
router.post("/quotes", validateBody(quoteRequestSchema), createQuotes);

export default router;
