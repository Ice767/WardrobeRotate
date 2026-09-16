import {randomUUID} from "node:crypto";

import type {NextFunction, Request, Response} from "express";

import type {UserRole} from "../contracts/auth.contract";
import * as authService from "../services/auth.service";
import {successResponse} from "../utils";

const HTTP_CREATED = 201;

interface CreateUserRequestBody {
    email: string;
    password: string;
    name: string;
    role: UserRole;
    companyName?: string;
    carrierId?: string;
}

export const createUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    const correlationId = randomUUID();
    res.locals.correlationId = correlationId;

    try {
        const input = req.body as CreateUserRequestBody;
        const user = await authService.createUserWithRole(input);

        // Deliberately no Set-Cookie here: an admin is creating somebody else's
        // account, and issuing a token would swap the admin's own session for
        // the new user's.
        res.status(HTTP_CREATED).json(successResponse(user, correlationId));
    } catch (error) {
        next(error);
    }
};
