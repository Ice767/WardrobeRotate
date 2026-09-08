import {randomUUID} from "node:crypto";

import type {ErrorRequestHandler} from "express";

import {logger} from "../config/logger.config";
import {AppError} from "../errors/app.error";
import {errorResponse} from "../utils";

const HTTP_INTERNAL_SERVER_ERROR = 500;

export const errorHandler: ErrorRequestHandler = (error, req, res, _next): void => {
    const correlationId =
        typeof res.locals.correlationId === "string"
            ? res.locals.correlationId
            : randomUUID();

    const isAppError = error instanceof AppError;

    const statusCode = isAppError ? error.statusCode : HTTP_INTERNAL_SERVER_ERROR;
    const errorMessage = isAppError ? error.message : "Internal server error";
    const errorCode = isAppError ? error.errorCode : undefined;
    const responseData = isAppError ? error.data : null;

    const logContext = {
        err: error,
        correlationId,
        method: req.method,
        path: req.path,
        statusCode,
    };

    if (statusCode >= HTTP_INTERNAL_SERVER_ERROR) {
        logger.error(logContext, "Request processing failed");
    } else {
        logger.warn(logContext, "Request rejected");
    }

    res.status(statusCode).json(
        errorResponse(errorMessage, responseData, correlationId, errorCode),
    );
};
