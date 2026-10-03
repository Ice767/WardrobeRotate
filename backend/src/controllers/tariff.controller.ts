import {randomUUID} from "node:crypto";

import type {NextFunction, Request, Response} from "express";

import type {
    CreateTariffInput,
    TariffActor,
    UpdateTariffInput,
} from "../contracts/tariff.contract";
import {ForbiddenError, UnauthorizedError} from "../errors/app.error";
import * as tariffService from "../services/tariff.service";
import type {ListTariffsFilter} from "../services/tariff.service";
import {successResponse} from "../utils";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;

const actorOf = (req: Request): TariffActor => {
    if (!req.user) {
        throw new UnauthorizedError("Unauthorized");
    }

    if (req.user.role !== "MANAGER" && req.user.role !== "ADMIN") {
        throw new ForbiddenError("Access is forbidden");
    }

    return {
        role: req.user.role,
        ...(req.user.carrierId !== undefined && {carrierId: req.user.carrierId}),
    };
};

const tariffIdOf = (req: Request): string => (req.params as {tariffId: string}).tariffId;

export const listTariffs = (req: Request, res: Response, next: NextFunction): void => {
    const correlationId = randomUUID();
    res.locals.correlationId = correlationId;

    try {
        const filter = res.locals.validatedQuery as ListTariffsFilter;
        const tariffs = tariffService.listTariffs(actorOf(req), filter);

        res.status(HTTP_OK).json(successResponse(tariffs, correlationId));
    } catch (error) {
        next(error);
    }
};

export const getTariff = (req: Request, res: Response, next: NextFunction): void => {
    const correlationId = randomUUID();
    res.locals.correlationId = correlationId;

    try {
        const tariff = tariffService.getTariff(actorOf(req), tariffIdOf(req));

        res.status(HTTP_OK).json(successResponse(tariff, correlationId));
    } catch (error) {
        next(error);
    }
};

export const createTariff = (req: Request, res: Response, next: NextFunction): void => {
    const correlationId = randomUUID();
    res.locals.correlationId = correlationId;

    try {
        const tariff = tariffService.createTariff(actorOf(req), req.body as CreateTariffInput);

        res.status(HTTP_CREATED).json(successResponse(tariff, correlationId));
    } catch (error) {
        next(error);
    }
};

export const updateTariff = (req: Request, res: Response, next: NextFunction): void => {
    const correlationId = randomUUID();
    res.locals.correlationId = correlationId;

    try {
        const tariff = tariffService.updateTariff(
            actorOf(req),
            tariffIdOf(req),
            req.body as UpdateTariffInput,
        );

        res.status(HTTP_OK).json(successResponse(tariff, correlationId));
    } catch (error) {
        next(error);
    }
};

export const deleteTariff = (req: Request, res: Response, next: NextFunction): void => {
    try {
        tariffService.deleteTariff(actorOf(req), tariffIdOf(req));
        res.status(HTTP_NO_CONTENT).send();
    } catch (error) {
        next(error);
    }
};
