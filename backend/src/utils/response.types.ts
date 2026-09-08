export type ResponseStatus = "SUCCESS" | "FAILED";

export interface ResponseMeta {
    correlationId: string;
    status: ResponseStatus;
    timestamp: string;
    errorCode?: string;
    errorMessage?: string;
}

export interface ResponseEnvelope<T> {
    success: boolean;
    meta: ResponseMeta;
    data: T;
}

export interface CreateResponseOptions<T> {
    success: boolean;
    status: ResponseStatus;
    data: T;
    correlationId?: string;
    errorCode?: string;
    errorMessage?: string;
}
