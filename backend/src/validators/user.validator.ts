import {z} from "zod";

import {USER_ROLES} from "../contracts/auth.contract";

// carrierId is what binds a MANAGER to the one carrier they may speak for, so
// the two fields are only meaningful together. Pairing them here — where the
// shape is already being checked — keeps the service from having to re-derive
// what the request meant. Whether the carrier actually exists is a different
// question, answered in the service, which is the layer that can see the store.
export const createUserSchema = z
    .object({
        email: z.string().email().max(254),
        password: z.string().min(8).max(72),
        name: z.string().min(1).max(120),
        role: z.enum(USER_ROLES),
        companyName: z.string().min(1).max(200).optional(),
        carrierId: z.string().uuid().optional(),
    })
    .superRefine((value, ctx) => {
        if (value.role === "MANAGER" && value.carrierId === undefined) {
            ctx.addIssue({
                code: "custom",
                path: ["carrierId"],
                message: "carrierId is required for the MANAGER role",
            });
        }

        // Rejected rather than ignored: silently dropping the field would hide
        // the fact that the caller expected a binding that never happened.
        if (value.role !== "MANAGER" && value.carrierId !== undefined) {
            ctx.addIssue({
                code: "custom",
                path: ["carrierId"],
                message: `carrierId is only allowed for the MANAGER role, not ${value.role}`,
            });
        }
    });
