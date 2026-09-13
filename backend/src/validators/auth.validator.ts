import {z} from "zod";

import {USER_ROLES} from "../contracts/auth.contract";

export const registerUserSchema = z.object({
    email: z.string().email().max(254),
    // bcrypt silently truncates past 72 bytes, so the upper bound is explicit.
    password: z.string().min(8).max(72),
    name: z.string().min(1).max(120),
    companyName: z.string().min(1).max(200).optional(),
});

export const loginUserSchema = z.object({
    email: z.string().email().max(254),
    password: z.string().min(1).max(72),
});

export const createUserSchema = z.object({
    email: z.string().email().max(254),
    password: z.string().min(8).max(72),
    name: z.string().min(1).max(120),
    role: z.enum(USER_ROLES),
    companyName: z.string().min(1).max(200).optional(),
    carrierId: z.string().uuid().optional(),
});
