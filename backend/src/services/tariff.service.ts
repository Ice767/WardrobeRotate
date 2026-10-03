import {randomUUID} from "node:crypto";

import type {
    CreateTariffInput,
    Tariff,
    TariffActor,
    TariffLaneKey,
    UpdateTariffInput,
} from "../contracts/tariff.contract";
import type {TransportType} from "../contracts/transport.contract";
import {carriersById, regionsById, tariffIdByLane, tariffsById} from "../data/store";
import {
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
} from "../errors/app.error";

export interface ListTariffsFilter {
    carrierId?: string;
    fromRegionId?: string;
    toRegionId?: string;
    transportType?: TransportType;
}

const laneKeyOf = (lane: TariffLaneKey): string => {
    return [lane.carrierId, lane.fromRegionId, lane.toRegionId, lane.transportType].join("|");
};

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
const findVisibleTariff = (actor: TariffActor, tariffId: string): Tariff => {
    const tariff = tariffsById.get(tariffId);

    if (!tariff || (actor.role === "MANAGER" && tariff.carrierId !== actor.carrierId)) {
        throw new NotFoundError("Tariff not found");
    }

    return tariff;
};

const assertLaneIsValid = (lane: TariffLaneKey): void => {
    const carrier = carriersById.get(lane.carrierId);

    if (!carrier) {
        throw new BadRequestError("Unknown carrierId");
    }

    if (!carrier.supportedTransportTypes.includes(lane.transportType)) {
        throw new BadRequestError(
            `Carrier ${carrier.name} does not operate ${lane.transportType}`,
        );
    }

    if (!regionsById.has(lane.fromRegionId)) {
        throw new BadRequestError("Unknown fromRegionId");
    }

    if (!regionsById.has(lane.toRegionId)) {
        throw new BadRequestError("Unknown toRegionId");
    }

    if (tariffIdByLane.has(laneKeyOf(lane))) {
        throw new ConflictError("A tariff for this lane already exists");
    }
};

/** Integrity-checked insert, shared by the API and the seed. */
export const insertTariff = (tariff: Tariff): Tariff => {
    assertLaneIsValid(tariff);

    tariffsById.set(tariff.tariffId, tariff);
    tariffIdByLane.set(laneKeyOf(tariff), tariff.tariffId);

    return tariff;
};

export const listTariffs = (actor: TariffActor, filter: ListTariffsFilter = {}): Tariff[] => {
    const carrierId = actor.role === "MANAGER" ? actor.carrierId : filter.carrierId;

    return [...tariffsById.values()].filter((tariff) => {
        return (
            (carrierId === undefined || tariff.carrierId === carrierId) &&
            (filter.fromRegionId === undefined || tariff.fromRegionId === filter.fromRegionId) &&
            (filter.toRegionId === undefined || tariff.toRegionId === filter.toRegionId) &&
            (filter.transportType === undefined || tariff.transportType === filter.transportType)
        );
    });
};

export const getTariff = (actor: TariffActor, tariffId: string): Tariff => {
    return findVisibleTariff(actor, tariffId);
};

export const createTariff = (actor: TariffActor, input: CreateTariffInput): Tariff => {
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
export const updateTariff = (
    actor: TariffActor,
    tariffId: string,
    patch: UpdateTariffInput,
): Tariff => {
    const current = findVisibleTariff(actor, tariffId);
    const updated: Tariff = {...current, ...patch};

    // The validator sees only the patch; whether both rates end up at zero is
    // knowable only after merging it with what is stored.
    if (updated.pricePerKgCents === 0 && updated.pricePerM3Cents === 0) {
        throw new BadRequestError(
            "At least one of pricePerKgCents or pricePerM3Cents must stay positive",
        );
    }

    tariffsById.set(tariffId, updated);

    return updated;
};

export const deleteTariff = (actor: TariffActor, tariffId: string): void => {
    const tariff = findVisibleTariff(actor, tariffId);

    tariffsById.delete(tariffId);
    tariffIdByLane.delete(laneKeyOf(tariff));
};
