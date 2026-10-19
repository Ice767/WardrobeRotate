import {z} from "zod";

import {CARGO_CATEGORIES} from "../contracts/cargo.contract";
import {RFQ_STATUSES} from "../contracts/rfq.contract";
import {TRANSPORT_TYPES} from "../contracts/transport.contract";

const MAX_WEIGHT_KG = 68_000;
const MAX_VOLUME_M3 = 138;
const MAX_CENTS = 10_000_000_000;
const MAX_TRANSIT_DAYS = 365;

export const rfqIdParamSchema = z.object({
    rfqId: z.string().uuid(),
});

export const createRfqSchema = z
    .strictObject({
        fromRegionId: z.string().uuid(),
        toRegionId: z.string().uuid(),
        weightKg: z.number().positive().max(MAX_WEIGHT_KG),
        volumeM3: z.number().positive().max(MAX_VOLUME_M3),
        cargoCategory: z.enum(CARGO_CATEGORIES),
        transportType: z.enum(TRANSPORT_TYPES).optional(),
        readyDate: z.string().date().optional(),
        description: z.string().min(1).max(2_000).optional(),
        // Declared value of a whole consignment, not a per-kg rate, so the
        // ceiling is higher than the tariff one.
        declaredValueCents: z.number().int().positive().max(MAX_CENTS).optional(),
    })
    .refine((value) => value.fromRegionId !== value.toRegionId, {
        path: ["toRegionId"],
        message: "toRegionId must differ from fromRegionId",
    });

export const submitRfqQuoteSchema = z.strictObject({
    transportType: z.enum(TRANSPORT_TYPES),
    priceCents: z.number().int().positive().max(MAX_CENTS),
    transitDays: z.number().int().min(1).max(MAX_TRANSIT_DAYS),
    validUntil: z.string().datetime(),
    comment: z.string().min(1).max(1_000).optional(),
});

export const acceptRfqQuoteSchema = z.strictObject({
    quoteId: z.string().uuid(),
});

export const listRfqsQuerySchema = z.object({
    status: z.enum(RFQ_STATUSES).optional(),
});
