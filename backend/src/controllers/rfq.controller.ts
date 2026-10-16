import {randomUUID} from "node:crypto";

import type {NextFunction, Request, Response} from "express";

import type {CreateRfqInput, RfqActor, RfqView, SubmitRfqQuoteInput} from "../contracts/rfq.contract";
import {UnauthorizedError} from "../errors/app.error";
import * as rfqService from "../services/rfq.service";
import type {ListRfqsFilter} from "../services/rfq.service";
import {successResponse} from "../utils";

const HTTP_OK = 200;
const HTTP_CREATED = 201;

const actorOf = (req: Request): RfqActor => {
    if (!req.user) {
        throw new UnauthorizedError("Unauthorized");
    }

    return {
        userId: req.user.sub,
        role: req.user.role,
        ...(req.user.carrierId !== undefined && {carrierId: req.user.carrierId}),
    };
};

const rfqIdOf = (req: Request): string => (req.params as {rfqId: string}).rfqId;

// Every RFQ handler differs only in the service call and the status code.
const handle = (
    status: number,
    run: (req: Request, res: Response) => RfqView | RfqView[],
) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const correlationId = randomUUID();
        res.locals.correlationId = correlationId;

        try {
            res.status(status).json(successResponse(run(req, res), correlationId));
        } catch (error) {
            next(error);
        }
    };
};

export const createRfq = handle(HTTP_CREATED, (req) =>
    rfqService.createRfq(actorOf(req), req.body as CreateRfqInput),
);

export const listRfqs = handle(HTTP_OK, (req, res) =>
    rfqService.listRfqs(actorOf(req), res.locals.validatedQuery as ListRfqsFilter),
);

export const getRfq = handle(HTTP_OK, (req) => rfqService.getRfq(actorOf(req), rfqIdOf(req)));

export const submitQuote = handle(HTTP_OK, (req) =>
    rfqService.submitQuote(actorOf(req), rfqIdOf(req), req.body as SubmitRfqQuoteInput),
);

export const acceptQuote = handle(HTTP_OK, (req) =>
    rfqService.acceptQuote(actorOf(req), rfqIdOf(req), (req.body as {quoteId: string}).quoteId),
);

export const cancelRfq = handle(HTTP_OK, (req) => rfqService.cancelRfq(actorOf(req), rfqIdOf(req)));
