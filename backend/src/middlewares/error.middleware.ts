import {randomUUID} from "node:crypto";

import type {ErrorRequestHandler} from "express";

import {logger} from "../config/logger.config";
import {AppError} from "../errors/app.error";
import {errorResponse} from "../utils";

const HTTP_BAD_REQUEST = 400;
const HTTP_INTERNAL_SERVER_ERROR = 500;

interface HttpError {
    status: number;
    expose: boolean;
    type?: string;
    message: string;
}

// express.json() rejects bodies before any route runs, with http-errors objects
// rather than AppError: malformed JSON, oversize, a bad charset. They are the
// client's mistake and must not be reported as a server failure. `expose` is
// http-errors' own flag for "this message is safe to show the client".
const isClientHttpError = (error: unknown): error is HttpError => {
    const candidate = error as Partial<HttpError> | null;

    return (
        typeof candidate?.status === "number" &&
        candidate.status >= HTTP_BAD_REQUEST &&
        candidate.status < HTTP_INTERNAL_SERVER_ERROR &&
        candidate.expose === true
    );
};

const normalize = (error: unknown): unknown => {
    if (!isClientHttpError(error)) {
        return error;
    }

    // The parser's own message quotes the offending input; a fixed one is enough.
    const message =
        error.type === "entity.parse.failed" ? "Request body is not valid JSON" : error.message;

    return new AppError(message, error.status);
};

export const errorHandler: ErrorRequestHandler = (rawError, req, res, _next): void => {
    const correlationId =
        typeof res.locals.correlationId === "string"
            ? res.locals.correlationId
            : randomUUID();

    const error = normalize(rawError);
    const isAppError = error instanceof AppError;

    const statusCode = isAppError ? error.statusCode : HTTP_INTERNAL_SERVER_ERROR;
    const errorMessage = isAppError ? error.message : "Internal server error";
    const errorCode = isAppError ? error.errorCode : undefined;
    const responseData = isAppError ? error.data : null;

    const logContext = {
        err: rawError,
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
