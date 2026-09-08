import {randomUUID} from "node:crypto";

import type {CreateResponseOptions, ResponseEnvelope} from "./response.types";

export const createResponse = <T>({
    success,
    status,
    data,
    correlationId = randomUUID(),
    errorCode,
    errorMessage,
}: CreateResponseOptions<T>): ResponseEnvelope<T> => {
    return {
        success,
        meta: {
            correlationId,
            status,
            timestamp: new Date().toISOString(),
            ...(errorCode !== undefined && {errorCode}),
            ...(errorMessage !== undefined && {errorMessage}),
        },
        data,
    };
};

export const successResponse = <T>(
    data: T,
    correlationId?: string,
): ResponseEnvelope<T> => {
    return createResponse({
        success: true,
        status: "SUCCESS",
        data,
        correlationId,
    });
};

export const errorResponse = <T = null>(
    errorMessage: string,
    data: T = null as T,
    correlationId?: string,
    errorCode?: string,
): ResponseEnvelope<T> => {
    return createResponse({
        success: false,
        status: "FAILED",
        data,
        correlationId,
        errorCode,
        errorMessage,
    });
};
