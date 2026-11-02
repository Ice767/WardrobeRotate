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
import {
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
} from "../errors/app.error";
import {DuplicateError, repos} from "../repositories";
import type {Scope} from "../repositories/types";
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
const CODE_ATTEMPTS = 5;

// Random, not a running counter: a counter needs one shared sequence that every
// server increments atomically, and a sequential code lets anyone walk through
// other people's shipments by adding one.
const newTrackingCode = (): string => {
    const code = [...randomBytes(CODE_LENGTH)].map((byte) => CODE_ALPHABET[byte % 32]).join("");
    return `FM-${code}`;
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

const scopeOf = (actor: ShipmentActor): Scope => {
    if (actor.role === "CLIENT") return {clientId: actor.userId};
    if (actor.role === "MANAGER") return {carrierId: actor.carrierId ?? "00000000-0000-0000-0000-000000000000"};
    return {};
};

const findVisibleShipment = async (actor: ShipmentActor, shipmentId: string): Promise<Shipment> => {
    const shipment = await repos().shipments.findById(shipmentId);

    if (!shipment || !canSee(actor, shipment)) {
        throw new NotFoundError("Shipment not found");
    }

    return shipment;
};

// 32^8 codes make a clash vanishingly rare, but the storage's unique rule has
// the final word: on a clash, draw again rather than check-then-insert.
const store = async (draft: Omit<Shipment, "trackingCode">): Promise<Shipment> => {
    for (let attempt = 1; ; attempt += 1) {
        const shipment: Shipment = {...draft, trackingCode: newTrackingCode()};

        try {
            await repos().shipments.insert(shipment);
            return shipment;
        } catch (error) {
            if (error instanceof DuplicateError && error.field === "rfqId") {
                throw new ConflictError("This RFQ has already been booked");
            }

            if (!(error instanceof DuplicateError && error.field === "trackingCode") || attempt >= CODE_ATTEMPTS) {
                throw error;
            }
        }
    }
};

const confirmed = (actor: ShipmentActor, now: Date) => ({
    status: "CONFIRMED" as const,
    history: [{status: "CONFIRMED" as const, at: now.toISOString(), byUserId: actor.userId, byRole: actor.role}],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
});

// The price is recomputed here, never taken from the request: the client says
// which offer it wants, the server says what that offer costs right now.
const bookInstant = async (actor: ShipmentActor, input: BookInstantInput, now: Date): Promise<Shipment> => {
    const offer = (
        await findQuotes({
            fromRegionId: input.fromRegionId,
            toRegionId: input.toRegionId,
            weightKg: input.weightKg,
            volumeM3: input.volumeM3,
            cargoCategory: input.cargoCategory,
            transportType: input.transportType,
        })
    ).find((quote) => quote.carrierId === input.carrierId);

    if (!offer) {
        throw new BadRequestError("This carrier has no offer for this shipment");
    }

    if (offer.pricingMode !== "INSTANT" || offer.priceCents === undefined) {
        throw new BadRequestError(`${input.cargoCategory} cargo has no bookable price; file an RFQ instead`);
    }

    return store({
        shipmentId: randomUUID(),
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

const bookFromRfq = async (actor: ShipmentActor, input: BookFromRfqInput, now: Date): Promise<Shipment> => {
    // getRfq applies the RFQ's own visibility: only its client gets this far.
    const rfq = await getRfq(actor, input.rfqId, now);

    if (rfq.status !== "ACCEPTED") {
        throw new ConflictError(`RFQ is ${rfq.status}; only an ACCEPTED RFQ can be booked`);
    }

    const quote = rfq.quotes.find((q) => q.quoteId === rfq.acceptedQuoteId);

    if (!quote) {
        throw new ConflictError("Accepted quote is missing");
    }

    // "Booked once" is the storage's unique rule on rfqId, not a lookup here.
    return store({
        shipmentId: randomUUID(),
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

export const bookShipment = async (
    actor: ShipmentActor,
    input: BookShipmentInput,
    now: Date = new Date(),
): Promise<Shipment> => {
    if (actor.role !== "CLIENT") {
        throw new ForbiddenError("Only clients can book shipments");
    }

    return input.source === "INSTANT" ? bookInstant(actor, input, now) : bookFromRfq(actor, input, now);
};

export const listShipments = async (actor: ShipmentActor, filter: ListShipmentsFilter = {}): Promise<Shipment[]> => {
    const shipments = await repos().shipments.list(scopeOf(actor));
    return shipments.filter((shipment) => filter.status === undefined || shipment.status === filter.status);
};

export const getShipment = (actor: ShipmentActor, shipmentId: string): Promise<Shipment> => {
    return findVisibleShipment(actor, shipmentId);
};

export const changeStatus = async (
    actor: ShipmentActor,
    shipmentId: string,
    to: ShipmentStatus,
    note: string | undefined,
    now: Date = new Date(),
): Promise<Shipment> => {
    const shipment = await findVisibleShipment(actor, shipmentId);
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
            {status: to, at: now.toISOString(), byUserId: actor.userId, byRole: actor.role, ...(note !== undefined && {note})},
        ],
        updatedAt: now.toISOString(),
    };

    if (!(await repos().shipments.transition(updated, shipment.status))) {
        throw new ConflictError("The shipment changed while you were updating it; reload and try again");
    }

    return updated;
};

/**
 * Anyone with the code can follow the parcel, as with any courier. They learn
 * where it is going and when it moved, never who sent it, what is inside or
 * what it cost; notes stay private too, as carriers write them for the client.
 */
export const trackShipment = async (trackingCode: string): Promise<PublicTracking> => {
    const shipment = await repos().shipments.findByTrackingCode(trackingCode.toUpperCase());

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
