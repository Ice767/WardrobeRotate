import type {NextFunction, Request, Response} from "express";

import type {UserRole} from "../contracts/auth.contract";
import {ForbiddenError, UnauthorizedError} from "../errors/app.error";
import {verifyAccessToken} from "../services/token.service";

export function authMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
): void {
    const token = req.cookies?.accessToken;

    if (!token) {
        next(new UnauthorizedError("No access token"));
        return;
    }

    try {
        req.user = verifyAccessToken(token);
        next();
    } catch {
        // The library distinguishes an expired token from a forged one, but the
        // client does not need that difference — both are fixed by logging in.
        next(new UnauthorizedError("Invalid or expired token"));
    }
}

export function requireRole(...roles: UserRole[]) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            next(new UnauthorizedError("Unauthorized"));
            return;
        }

        if (!roles.includes(req.user.role)) {
            next(new ForbiddenError("Access is forbidden"));
            return;
        }

        next();
    };
}
