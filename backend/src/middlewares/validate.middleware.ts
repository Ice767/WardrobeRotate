import type {RequestHandler} from "express";
import {z, type ZodType} from "zod";

import {BadRequestError} from "../errors/app.error";

export const validateBody = (schema: ZodType): RequestHandler => {
    return (req, _res, next): void => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            next(
                new BadRequestError(
                    "Request body validation failed",
                    z.flattenError(result.error),
                ),
            );
            return;
        }

        req.body = result.data;
        next();
    };
};

export const validateParams = (schema: ZodType): RequestHandler => {
    return (req, _res, next): void => {
        const result = schema.safeParse(req.params);

        if (!result.success) {
            next(
                new BadRequestError(
                    "Request parameters validation failed",
                    z.flattenError(result.error),
                ),
            );
            return;
        }

        req.params = result.data as typeof req.params;
        next();
    };
};

// Express 5 made req.query an immutable getter, so the parsed result goes to
// res.locals instead of back onto req.
export const validateQuery = (schema: ZodType): RequestHandler => {
    return (req, res, next): void => {
        const result = schema.safeParse(req.query);

        if (!result.success) {
            next(
                new BadRequestError(
                    "Request query validation failed",
                    z.flattenError(result.error),
                ),
            );
            return;
        }

        res.locals.validatedQuery = result.data;
        next();
    };
};
