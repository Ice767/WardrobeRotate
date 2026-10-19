import {z} from "zod";

import {CARGO_CATEGORIES} from "../contracts/cargo.contract";
import {SHIPMENT_STATUSES} from "../contracts/shipment.contract";
import {TRANSPORT_TYPES} from "../contracts/transport.contract";

const MAX_WEIGHT_KG = 68_000;
const MAX_VOLUME_M3 = 138;

export const shipmentIdParamSchema = z.object({
    shipmentId: z.string().uuid(),
});

export const trackingCodeParamSchema = z.object({
    // Case-insensitive: people type tracking codes by hand, often on a phone.
    trackingCode: z.string().regex(/^FM-[0-9A-Z]{8}$/i, "Expected a code like FM-7K2Q9XNA"),
});

// Two shapes behind one endpoint, told apart by `source`. A discriminated union
// reports errors against the shape the caller actually meant to send.
export const bookShipmentSchema = z.discriminatedUnion("source", [
    z.strictObject({
        source: z.literal("INSTANT"),
        carrierId: z.string().uuid(),
        transportType: z.enum(TRANSPORT_TYPES),
        fromRegionId: z.string().uuid(),
        toRegionId: z.string().uuid(),
        weightKg: z.number().positive().max(MAX_WEIGHT_KG),
        volumeM3: z.number().positive().max(MAX_VOLUME_M3),
        cargoCategory: z.enum(CARGO_CATEGORIES).default("GENERAL"),
        description: z.string().min(1).max(2_000).optional(),
    }),
    z.strictObject({
        source: z.literal("RFQ"),
        rfqId: z.string().uuid(),
    }),
]);

export const changeStatusSchema = z.strictObject({
    status: z.enum(SHIPMENT_STATUSES),
    note: z.string().min(1).max(500).optional(),
});

export const listShipmentsQuerySchema = z.object({
    status: z.enum(SHIPMENT_STATUSES).optional(),
});
