import {randomBytes, randomUUID} from "node:crypto";

import type {
    BookFromRfqInput,
    BookInstantInput,
    BookShipmentInput,
    PublicTracking,
    Shipment,
    ShipmentActor,
    ShipmentStatus,
} from "../contracts/shipment.contract";
import {shipmentIdByRfqId, shipmentIdByTrackingCode, shipmentsById} from "../data/store";
import {
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
} from "../errors/app.error";
import {findQuotes} from "./quote.service";
import {getRfq} from "./rfq.service";
import {checkTransition} from "./shipment.state";

export interface ListShipmentsFilter {
    status?: ShipmentStatus;
}

// Crockford base32: no I, L, O or U, so a code read aloud over the phone
// cannot be misheard as a digit.
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 8;

// Random, not a running counter: a counter needs one shared sequence that every
// server increments atomically, and a sequential code lets anyone walk through
// other people's shipments by adding one.
const newTrackingCode = (): string => {
    for (;;) {
        const bytes = randomBytes(CODE_LENGTH);
        const code = [...bytes].map((byte) => CODE_ALPHABET[byte % 32]).join("");

        if (!shipmentIdByTrackingCode.has(code)) {
            return `FM-${code}`;
        }
    }
};

const canSee = (actor: ShipmentActor, shipment: Shipment): boolean => {
    if (actor.role === "ADMIN") {
        return true;
    }

    if (actor.role === "CLIENT") {
        return shipment.clientId === actor.userId;
    }

    return actor.carrierId !== undefined && shipment.carrierId === actor.carrierId;
};

const findVisibleShipment = (actor: ShipmentActor, shipmentId: string): Shipment => {
    const shipment = shipmentsById.get(shipmentId);

    if (!shipment || !canSee(actor, shipment)) {
        throw new NotFoundError("Shipment not found");
    }

    return shipment;
};

const store = (shipment: Shipment): Shipment => {
    shipmentsById.set(shipment.shipmentId, shipment);
    shipmentIdByTrackingCode.set(shipment.trackingCode, shipment.shipmentId);

    if (shipment.rfqId !== undefined) {
        shipmentIdByRfqId.set(shipment.rfqId, shipment.shipmentId);
    }

    return shipment;
};

const confirmed = (actor: ShipmentActor, now: Date) => ({
    status: "CONFIRMED" as const,
    history: [{status: "CONFIRMED" as const, at: now.toISOString(), byUserId: actor.userId, byRole: actor.role}],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
});

// The price is recomputed here, never taken from the request: the client says
// which offer it wants, the server says what that offer costs right now.
const bookInstant = (actor: ShipmentActor, input: BookInstantInput, now: Date): Shipment => {
    const offer = findQuotes({
        fromRegionId: input.fromRegionId,
        toRegionId: input.toRegionId,
        weightKg: input.weightKg,
        volumeM3: input.volumeM3,
        cargoCategory: input.cargoCategory,
        transportType: input.transportType,
    }).find((quote) => quote.carrierId === input.carrierId);

    if (!offer) {
        throw new BadRequestError("This carrier has no offer for this shipment");
    }

    if (offer.pricingMode !== "INSTANT" || offer.priceCents === undefined) {
        throw new BadRequestError(
            `${input.cargoCategory} cargo has no bookable price; file an RFQ instead`,
        );
    }

    return store({
        shipmentId: randomUUID(),
        trackingCode: newTrackingCode(),
        source: "INSTANT",
        clientId: actor.userId,
        carrierId: offer.carrierId,
        transportType: offer.transportType,
        fromRegionId: input.fromRegionId,
        toRegionId: input.toRegionId,
        weightKg: input.weightKg,
        volumeM3: input.volumeM3,
        cargoCategory: input.cargoCategory,
        ...(input.description !== undefined && {description: input.description}),
        priceCents: offer.priceCents,
        transitDays: offer.transitDays,
        ...confirmed(actor, now),
    });
};

const bookFromRfq = (actor: ShipmentActor, input: BookFromRfqInput, now: Date): Shipment => {
    // getRfq applies the RFQ's own visibility: only its client gets this far.
    const rfq = getRfq(actor, input.rfqId, now);

    if (rfq.status !== "ACCEPTED") {
        throw new ConflictError(`RFQ is ${rfq.status}; only an ACCEPTED RFQ can be booked`);
    }

    if (shipmentIdByRfqId.has(rfq.rfqId)) {
        throw new ConflictError("This RFQ has already been booked");
    }

    const quote = rfq.quotes.find((q) => q.quoteId === rfq.acceptedQuoteId);

    if (!quote) {
        throw new ConflictError("Accepted quote is missing");
    }

    return store({
        shipmentId: randomUUID(),
        trackingCode: newTrackingCode(),
        source: "RFQ",
        rfqId: rfq.rfqId,
        clientId: actor.userId,
        carrierId: quote.carrierId,
        transportType: quote.transportType,
        fromRegionId: rfq.fromRegionId,
        toRegionId: rfq.toRegionId,
        weightKg: rfq.weightKg,
        volumeM3: rfq.volumeM3,
        cargoCategory: rfq.cargoCategory,
        ...(rfq.description !== undefined && {description: rfq.description}),
        ...(rfq.declaredValueCents !== undefined && {declaredValueCents: rfq.declaredValueCents}),
        priceCents: quote.priceCents,
        transitDays: quote.transitDays,
        ...confirmed(actor, now),
    });
};

export const bookShipment = (
    actor: ShipmentActor,
    input: BookShipmentInput,
    now: Date = new Date(),
): Shipment => {
    if (actor.role !== "CLIENT") {
        throw new ForbiddenError("Only clients can book shipments");
    }

    return input.source === "INSTANT"
        ? bookInstant(actor, input, now)
        : bookFromRfq(actor, input, now);
};

export const listShipments = (
    actor: ShipmentActor,
    filter: ListShipmentsFilter = {},
): Shipment[] => {
    return [...shipmentsById.values()]
        .filter((shipment) => canSee(actor, shipment))
        .filter((shipment) => filter.status === undefined || shipment.status === filter.status)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

export const getShipment = (actor: ShipmentActor, shipmentId: string): Shipment => {
    return findVisibleShipment(actor, shipmentId);
};

export const changeStatus = (
    actor: ShipmentActor,
    shipmentId: string,
    to: ShipmentStatus,
    note: string | undefined,
    now: Date = new Date(),
): Shipment => {
    const shipment = findVisibleShipment(actor, shipmentId);
    const check = checkTransition(shipment.status, to, actor.role);

    if (!check.allowed) {
        throw check.reason === "ROLE_NOT_ALLOWED"
            ? new ForbiddenError(`${actor.role} cannot move a shipment to ${to}`)
            : new ConflictError(`Cannot go from ${shipment.status} to ${to}`);
    }

    const updated: Shipment = {
        ...shipment,
        status: to,
        history: [
            ...shipment.history,
            {
                status: to,
                at: now.toISOString(),
                byUserId: actor.userId,
                byRole: actor.role,
                ...(note !== undefined && {note}),
            },
        ],
        updatedAt: now.toISOString(),
    };

    shipmentsById.set(shipmentId, updated);

    return updated;
};

/**
 * Anyone with the code can follow the parcel, as with any courier. They learn
 * where it is going and when it moved, never who sent it, what is inside or
 * what it cost; notes stay private too, as carriers write them for the client.
 */
export const trackShipment = (trackingCode: string): PublicTracking => {
    const shipmentId = shipmentIdByTrackingCode.get(trackingCode.toUpperCase());
    const shipment = shipmentId === undefined ? undefined : shipmentsById.get(shipmentId);

    if (!shipment) {
        throw new NotFoundError("No shipment with this tracking code");
    }

    return {
        trackingCode: shipment.trackingCode,
        status: shipment.status,
        transportType: shipment.transportType,
        fromRegionId: shipment.fromRegionId,
        toRegionId: shipment.toRegionId,
        history: shipment.history.map((event) => ({status: event.status, at: event.at})),
    };
};
