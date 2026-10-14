import {z} from "zod";

import {CARGO_CATEGORIES} from "../contracts/cargo.contract";
import {TRANSPORT_TYPES} from "../contracts/transport.contract";

// The largest single-shipment limits across all transport types (RAIL). Anything
// above cannot be quoted by any mode, so it is rejected before any lookup.
const MAX_WEIGHT_KG = 68_000;
const MAX_VOLUME_M3 = 138;

export const quoteRequestSchema = z
    .strictObject({
        fromRegionId: z.string().uuid(),
        toRegionId: z.string().uuid(),
        weightKg: z.number().positive().max(MAX_WEIGHT_KG),
        volumeM3: z.number().positive().max(MAX_VOLUME_M3),
        cargoCategory: z.enum(CARGO_CATEGORIES).default("GENERAL"),
        transportType: z.enum(TRANSPORT_TYPES).optional(),
    })
    .refine((value) => value.fromRegionId !== value.toRegionId, {
        path: ["toRegionId"],
        message: "toRegionId must differ from fromRegionId",
    });
