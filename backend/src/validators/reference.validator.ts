import {z} from "zod";

import {REGION_LEVELS} from "../contracts/region.contract";
import {TRANSPORT_TYPES} from "../contracts/transport.contract";

export const regionIdParamSchema = z.object({
    regionId: z.string().uuid(),
});

export const listRegionsQuerySchema = z.object({
    parentId: z.string().uuid().optional(),
    level: z.enum(REGION_LEVELS).optional(),
});

export const carrierIdParamSchema = z.object({
    carrierId: z.string().uuid(),
});

export const listCarriersQuerySchema = z.object({
    transportType: z.enum(TRANSPORT_TYPES).optional(),
});
