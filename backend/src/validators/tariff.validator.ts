import {z} from "zod";

import {TRANSPORT_TYPES} from "../contracts/transport.contract";

// Ceilings exist to catch unit mistakes, not to model the market: $100,000 per
// kilogram is someone who typed dollars into a cents field.
const MAX_CENTS = 10_000_000;
const MAX_TRANSIT_DAYS = 365;

const cents = z.number().int().nonnegative().max(MAX_CENTS);

const priceFields = {
    pricePerKgCents: cents,
    pricePerM3Cents: cents,
    minChargeCents: cents,
    transitDays: z.number().int().min(1).max(MAX_TRANSIT_DAYS),
};

export const tariffIdParamSchema = z.object({
    tariffId: z.string().uuid(),
});

export const createTariffSchema = z
    .strictObject({
        carrierId: z.string().uuid().optional(),
        fromRegionId: z.string().uuid(),
        toRegionId: z.string().uuid(),
        transportType: z.enum(TRANSPORT_TYPES),
        ...priceFields,
    })
    .refine((value) => value.fromRegionId !== value.toRegionId, {
        path: ["toRegionId"],
        message: "toRegionId must differ from fromRegionId",
    })
    .refine((value) => value.pricePerKgCents > 0 || value.pricePerM3Cents > 0, {
        path: ["pricePerKgCents"],
        message: "At least one of pricePerKgCents or pricePerM3Cents must be positive",
    });

// strictObject so that an attempt to move a tariff to another lane is reported
// as an error instead of being silently dropped by the parser.
export const updateTariffSchema = z
    .strictObject({
        pricePerKgCents: priceFields.pricePerKgCents.optional(),
        pricePerM3Cents: priceFields.pricePerM3Cents.optional(),
        minChargeCents: priceFields.minChargeCents.optional(),
        transitDays: priceFields.transitDays.optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "Provide at least one field to update",
    });

export const listTariffsQuerySchema = z.object({
    carrierId: z.string().uuid().optional(),
    fromRegionId: z.string().uuid().optional(),
    toRegionId: z.string().uuid().optional(),
    transportType: z.enum(TRANSPORT_TYPES).optional(),
});
