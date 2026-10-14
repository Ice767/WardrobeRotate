import {randomUUID} from "node:crypto";

import type {NextFunction, Request, Response} from "express";

import {CARGO_CATEGORY_SPECS} from "../contracts/cargo.contract";
import type {QuoteRequest} from "../contracts/quote.contract";
import * as quoteService from "../services/quote.service";
import {successResponse} from "../utils";

const HTTP_OK = 200;

export const createQuotes = (req: Request, res: Response, next: NextFunction): void => {
    const correlationId = randomUUID();
    res.locals.correlationId = correlationId;

    try {
        const quotes = quoteService.findQuotes(req.body as QuoteRequest);

        res.status(HTTP_OK).json(successResponse(quotes, correlationId));
    } catch (error) {
        next(error);
    }
};

export const listCargoCategories = (_req: Request, res: Response): void => {
    const correlationId = randomUUID();
    res.locals.correlationId = correlationId;

    res.status(HTTP_OK).json(
        successResponse(Object.values(CARGO_CATEGORY_SPECS), correlationId),
    );
};
