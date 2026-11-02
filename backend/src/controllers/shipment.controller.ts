import {randomUUID} from "node:crypto";

import type {NextFunction, Request, Response} from "express";

import type {BookShipmentInput, ShipmentActor, ShipmentStatus} from "../contracts/shipment.contract";
import {UnauthorizedError} from "../errors/app.error";
import * as shipmentService from "../services/shipment.service";
import type {ListShipmentsFilter} from "../services/shipment.service";
import {successResponse} from "../utils";

const HTTP_OK = 200;
const HTTP_CREATED = 201;

const actorOf = (req: Request): ShipmentActor => {
    if (!req.user) {
        throw new UnauthorizedError("Unauthorized");
    }

    return {
        userId: req.user.sub,
        role: req.user.role,
        ...(req.user.carrierId !== undefined && {carrierId: req.user.carrierId}),
    };
};

const handle = (status: number, run: (req: Request, res: Response) => Promise<unknown>) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const correlationId = randomUUID();
        res.locals.correlationId = correlationId;

        try {
            res.status(status).json(successResponse(await run(req, res), correlationId));
        } catch (error) {
            next(error);
        }
    };
};

const shipmentIdOf = (req: Request): string => (req.params as {shipmentId: string}).shipmentId;

export const bookShipment = handle(HTTP_CREATED, (req) =>
    shipmentService.bookShipment(actorOf(req), req.body as BookShipmentInput),
);

export const listShipments = handle(HTTP_OK, (req, res) =>
    shipmentService.listShipments(actorOf(req), res.locals.validatedQuery as ListShipmentsFilter),
);

export const getShipment = handle(HTTP_OK, (req) =>
    shipmentService.getShipment(actorOf(req), shipmentIdOf(req)),
);

export const changeStatus = handle(HTTP_OK, (req) => {
    const body = req.body as {status: ShipmentStatus; note?: string};
    return shipmentService.changeStatus(actorOf(req), shipmentIdOf(req), body.status, body.note);
});

export const trackShipment = handle(HTTP_OK, (req) =>
    shipmentService.trackShipment((req.params as {trackingCode: string}).trackingCode),
);
