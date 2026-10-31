export class AppError extends Error {
    constructor(
        message: string,
        public readonly statusCode: number,
        public readonly data: unknown = null,
        public readonly errorCode?: string,
    ) {
        super(message);
        this.name = new.target.name;
    }
}

export class BadRequestError extends AppError {
    constructor(message = "Invalid request", data: unknown = null, errorCode?: string) {
        super(message, 400, data, errorCode);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = "Unauthorized", data: unknown = null, errorCode?: string) {
        super(message, 401, data, errorCode);
    }
}

export class ForbiddenError extends AppError {
    constructor(message = "Forbidden", data: unknown = null, errorCode?: string) {
        super(message, 403, data, errorCode);
    }
}

export class NotFoundError extends AppError {
    constructor(message = "Resource not found", data: unknown = null, errorCode?: string) {
        super(message, 404, data, errorCode);
    }
}

export class ConflictError extends AppError {
    constructor(message = "Resource already exists", data: unknown = null, errorCode?: string) {
        super(message, 409, data, errorCode);
    }
}

export class TooManyRequestsError extends AppError {
    constructor(message = "Too many requests", data: unknown = null, errorCode?: string) {
        super(message, 429, data, errorCode);
    }
}
