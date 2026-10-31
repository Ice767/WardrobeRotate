import type {RequestHandler} from "express";
import {rateLimit} from "express-rate-limit";

import {TooManyRequestsError} from "../errors/app.error";

const MINUTE_MS = 60 * 1000;

// Counted per client IP, in this process's memory — the same limits as the
// store, and replaced together with it once there is more than one server.
const limiter = (options: {
    windowMs: number;
    limit: number;
    skipSuccessfulRequests?: boolean;
}): RequestHandler => {
    return rateLimit({
        ...options,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        // Through next() so the answer gets the usual envelope and log line.
        handler: (_req, _res, next) => {
            next(new TooManyRequestsError("Too many attempts, try again later"));
        },
    });
};

// Only failures count: someone who mistypes and then gets in is not slowed down,
// while guessing a password is capped at 10 tries per quarter hour per address.
export const loginRateLimit = limiter({
    windowMs: 15 * MINUTE_MS,
    limit: 10,
    skipSuccessfulRequests: true,
});

// Every sign-up counts: each costs a bcrypt hash, and a burst of them is
// either a script or someone filling the store.
export const registerRateLimit = limiter({
    windowMs: 60 * MINUTE_MS,
    limit: 10,
});
