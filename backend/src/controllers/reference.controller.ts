import {randomUUID} from "node:crypto";

import type {NextFunction, Request, Response} from "express";

import * as carrierService from "../services/carrier.service";
import * as regionService from "../services/region.service";
import * as transportService from "../services/transport.service";
import {successResponse} from "../utils";
import type {
    ListCarriersFilter,
} from "../services/carrier.service";
import type {ListRegionsFilter} from "../services/region.service";

const HTTP_OK = 200;

export const listRegions = (req: Request, res: Response, next: NextFunction): void => {
    const correlationId = randomUUID();
    res.locals.correlationId = correlationId;

    try {
        const filter = res.locals.validatedQuery as ListRegionsFilter;
        const regions = regionService.listRegions(filter);

        res.status(HTTP_OK).json(successResponse(regions, correlationId));
    } catch (error) {
        next(error);
    }
};

export const getRegion = (req: Request, res: Response, next: NextFunction): void => {
    const correlationId = randomUUID();
    res.locals.correlationId = correlationId;

    try {
        const {regionId} = req.params as {regionId: string};
        const region = regionService.getRegionWithPath(regionId);

        res.status(HTTP_OK).json(successResponse(region, correlationId));
    } catch (error) {
        next(error);
    }
};

export const listCarriers = (req: Request, res: Response, next: NextFunction): void => {
    const correlationId = randomUUID();
    res.locals.correlationId = correlationId;

    try {
        const filter = res.locals.validatedQuery as ListCarriersFilter;
        const carriers = carrierService.listCarriers(filter);

        res.status(HTTP_OK).json(successResponse(carriers, correlationId));
    } catch (error) {
        next(error);
    }
};

export const getCarrier = (req: Request, res: Response, next: NextFunction): void => {
    const correlationId = randomUUID();
    res.locals.correlationId = correlationId;

    try {
        const {carrierId} = req.params as {carrierId: string};
        const carrier = carrierService.getCarrierById(carrierId);

        res.status(HTTP_OK).json(successResponse(carrier, correlationId));
    } catch (error) {
        next(error);
    }
};

export const listTransportTypes = (_req: Request, res: Response): void => {
    const correlationId = randomUUID();
    res.locals.correlationId = correlationId;

    res.status(HTTP_OK).json(
        successResponse(transportService.listTransportTypeSpecs(), correlationId),
    );
};
