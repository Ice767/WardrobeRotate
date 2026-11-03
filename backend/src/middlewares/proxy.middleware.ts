import {createHash, timingSafeEqual} from "node:crypto";

import type {RequestHandler} from "express";

import {ForbiddenError} from "../errors/app.error";

const digest = (value: string): Buffer => createHash("sha256").update(value).digest();

// In production the API sits behind the Cloudflare Pages function, but its own
// address is public too. A request sent there directly could carry a forged
// X-Forwarded-For and dodge the sign-in rate limit. The function adds a shared
// secret; anything without it did not come through the proxy and is refused.
// Unset PROXY_SECRET (local development) turns the check off.
export const requireProxySecret = (secret: string | undefined): RequestHandler => {
    if (!secret) {
        return (_req, _res, next) => next();
    }

    const expected = digest(secret);

    return (req, _res, next) => {
        const given = req.get("X-Proxy-Secret") ?? "";

        // Hashing first gives equal lengths, which timingSafeEqual requires.
        if (!timingSafeEqual(digest(given), expected)) {
            next(new ForbiddenError("Requests must come through the site"));
            return;
        }

        next();
    };
};
