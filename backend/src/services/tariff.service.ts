import {randomUUID} from "node:crypto";

import type {
    CreateTariffInput,
    Tariff,
    TariffActor,
    TariffLaneKey,
    UpdateTariffInput,
} from "../contracts/tariff.contract";
import type {TransportType} from "../contracts/transport.contract";
import {carriersById, regionsById} from "../data/store";
import {
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
} from "../errors/app.error";
import {DuplicateError, repos} from "../repositories";

export interface ListTariffsFilter {
    carrierId?: string;
    fromRegionId?: string;
    toRegionId?: string;
    transportType?: TransportType;
}

// A manager acts for exactly one carrier, taken from their token, never from
// the request. Naming a different carrier is refused outright rather than
// quietly overridden, so a misdirected call fails loudly.
const resolveCarrierId = (actor: TariffActor, requested: string | undefined): string => {
    if (actor.role === "MANAGER") {
        if (actor.carrierId === undefined) {
            throw new ForbiddenError("Manager is not bound to a carrier");
        }

        if (requested !== undefined && requested !== actor.carrierId) {
            throw new ForbiddenError("Managers can only manage their own carrier's tariffs");
        }

        return actor.carrierId;
    }

    if (requested === undefined) {
        throw new BadRequestError("carrierId is required when acting as ADMIN");
    }

    return requested;
};

// A competitor's tariff answers 404, not 403: a 403 would confirm that the
// lane exists, which is itself commercial information.
const findVisibleTariff = async (actor: TariffActor, tariffId: string): Promise<Tariff> => {
    const tariff = await repos().tariffs.findById(tariffId);

    if (!tariff || (actor.role === "MANAGER" && tariff.carrierId !== actor.carrierId)) {
        throw new NotFoundError("Tariff not found");
    }

    return tariff;
};

// Carriers and regions are reference data in code, so these checks stay in the
// service. Uniqueness of the lane is the storage's job, enforced on insert.
const assertLaneIsValid = (lane: TariffLaneKey): void => {
    const carrier = carriersById.get(lane.carrierId);

    if (!carrier) {
        throw new BadRequestError("Unknown carrierId");
    }

    if (!carrier.supportedTransportTypes.includes(lane.transportType)) {
        throw new BadRequestError(`Carrier ${carrier.name} does not operate ${lane.transportType}`);
    }

    if (!regionsById.has(lane.fromRegionId)) {
        throw new BadRequestError("Unknown fromRegionId");
    }

    if (!regionsById.has(lane.toRegionId)) {
        throw new BadRequestError("Unknown toRegionId");
    }
};

/** Integrity-checked insert, shared by the API and the seed. */
export const insertTariff = async (tariff: Tariff): Promise<Tariff> => {
    assertLaneIsValid(tariff);

    try {
        await repos().tariffs.insert(tariff);
    } catch (error) {
        if (error instanceof DuplicateError) {
            throw new ConflictError("A tariff for this lane already exists");
        }
        throw error;
    }

    return tariff;
};

export const listTariffs = async (actor: TariffActor, filter: ListTariffsFilter = {}): Promise<Tariff[]> => {
    const carrierId = actor.role === "MANAGER" ? actor.carrierId : filter.carrierId;

    return repos().tariffs.list({...filter, carrierId});
};

export const getTariff = (actor: TariffActor, tariffId: string): Promise<Tariff> => {
    return findVisibleTariff(actor, tariffId);
};

export const createTariff = (actor: TariffActor, input: CreateTariffInput): Promise<Tariff> => {
    return insertTariff({
        tariffId: randomUUID(),
        carrierId: resolveCarrierId(actor, input.carrierId),
        fromRegionId: input.fromRegionId,
        toRegionId: input.toRegionId,
        transportType: input.transportType,
        pricePerKgCents: input.pricePerKgCents,
        pricePerM3Cents: input.pricePerM3Cents,
        minChargeCents: input.minChargeCents,
        transitDays: input.transitDays,
    });
};

// Only prices and transit time are editable. The lane is the tariff's identity:
// moving it would really be deleting one tariff and creating another, and doing
// that in place would let an update slip past the one-per-lane check.
export const updateTariff = async (
    actor: TariffActor,
    tariffId: string,
    patch: UpdateTariffInput,
): Promise<Tariff> => {
    const current = await findVisibleTariff(actor, tariffId);
    const updated: Tariff = {...current, ...patch};

    // The validator sees only the patch; whether both rates end up at zero is
    // knowable only after merging it with what is stored.
    if (updated.pricePerKgCents === 0 && updated.pricePerM3Cents === 0) {
        throw new BadRequestError("At least one of pricePerKgCents or pricePerM3Cents must stay positive");
    }

    await repos().tariffs.updatePrices(tariffId, updated);

    return updated;
};

export const deleteTariff = async (actor: TariffActor, tariffId: string): Promise<void> => {
    await findVisibleTariff(actor, tariffId);
    await repos().tariffs.delete(tariffId);
};
