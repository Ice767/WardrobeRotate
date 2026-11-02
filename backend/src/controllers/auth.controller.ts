import {randomUUID} from "node:crypto";

import type {NextFunction, Request, Response} from "express";

import type {
    LoginUserRequestBody,
    RegisterUserRequestBody,
} from "../contracts/auth.contract";
import {UnauthorizedError} from "../errors/app.error";
import * as authService from "../services/auth.service";
import {signAccessToken} from "../services/token.service";
import {successResponse} from "../utils";
import {clearAuthCookie, setAuthCookie} from "../utils/cookie.helper";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;

export const register = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    const correlationId = randomUUID();
    res.locals.correlationId = correlationId;

    try {
        const input = req.body as RegisterUserRequestBody;
        const user = await authService.registerUser(input);

        setAuthCookie(
            res,
            signAccessToken({sub: user.userId, role: user.role}),
        );

        res.status(HTTP_CREATED).json(successResponse(user, correlationId));
    } catch (error) {
        next(error);
    }
};

export const login = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    const correlationId = randomUUID();
    res.locals.correlationId = correlationId;

    try {
        const input = req.body as LoginUserRequestBody;
        const user = await authService.loginUser(input);

        setAuthCookie(
            res,
            signAccessToken({
                sub: user.userId,
                role: user.role,
                ...(user.carrierId !== undefined && {carrierId: user.carrierId}),
            }),
        );

        res.status(HTTP_OK).json(successResponse(user, correlationId));
    } catch (error) {
        next(error);
    }
};

export const logout = (_req: Request, res: Response): void => {
    clearAuthCookie(res);
    res.status(HTTP_NO_CONTENT).send();
};

export const me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const correlationId = randomUUID();
    res.locals.correlationId = correlationId;

    try {
        if (!req.user) {
            throw new UnauthorizedError("Unauthorized");
        }

        // Read from the store rather than the token: role or company may have
        // changed since it was issued.
        const user = await authService.getUserById(req.user.sub);

        res.status(HTTP_OK).json(successResponse(user, correlationId));
    } catch (error) {
        next(error);
    }
};
