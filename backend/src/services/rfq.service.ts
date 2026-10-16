import {randomUUID} from "node:crypto";

import {CARGO_CATEGORY_SPECS} from "../contracts/cargo.contract";
import type {
    CreateRfqInput,
    Rfq,
    RfqActor,
    RfqQuote,
    RfqStatus,
    RfqView,
    SubmitRfqQuoteInput,
} from "../contracts/rfq.contract";
import {rfqQuotesById, rfqsById} from "../data/store";
import {
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
} from "../errors/app.error";
import {findQuotes} from "./quote.service";

const RFQ_TTL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ListRfqsFilter {
    status?: RfqStatus;
}

// Expiry is worked out when an RFQ is read, not by a timer. Nothing has to run
// in the background, so this survives a process that sleeps between requests.
const refreshStatus = (rfq: Rfq, now: Date): Rfq => {
    if (rfq.status === "OPEN" && now.getTime() >= Date.parse(rfq.expiresAt)) {
        const expired: Rfq = {...rfq, status: "EXPIRED"};
        rfqsById.set(rfq.rfqId, expired);
        return expired;
    }

    return rfq;
};

const quotesOf = (rfqId: string): RfqQuote[] => {
    return [...rfqQuotesById.values()]
        .filter((quote) => quote.rfqId === rfqId)
        .sort((left, right) => left.priceCents - right.priceCents);
};

const canSee = (actor: RfqActor, rfq: Rfq): boolean => {
    if (actor.role === "ADMIN") {
        return true;
    }

    if (actor.role === "CLIENT") {
        return rfq.clientId === actor.userId;
    }

    return actor.carrierId !== undefined && rfq.eligibleCarrierIds.includes(actor.carrierId);
};

// Anything not visible answers 404, never 403: confirming that someone else's
// request exists already tells a competitor there is business on that lane.
const findVisibleRfq = (actor: RfqActor, rfqId: string, now: Date): Rfq => {
    const rfq = rfqsById.get(rfqId);

    if (!rfq || !canSee(actor, rfq)) {
        throw new NotFoundError("RFQ not found");
    }

    return refreshStatus(rfq, now);
};

const findOwnRfq = (actor: RfqActor, rfqId: string, now: Date): Rfq => {
    const rfq = findVisibleRfq(actor, rfqId, now);

    if (actor.role !== "CLIENT") {
        throw new ForbiddenError("Only the client who filed the RFQ can do this");
    }

    return rfq;
};

const assertOpen = (rfq: Rfq): void => {
    if (rfq.status !== "OPEN") {
        throw new ConflictError(`RFQ is ${rfq.status}, not OPEN`);
    }
};

/**
 * The one place an RFQ is shaped for a viewer.
 *
 * A carrier sees only its own quote: seeing rivals' prices would turn the RFQ
 * into a race to undercut instead of each carrier naming its real price.
 * For VALUABLE cargo the description and declared value stay hidden from every
 * carrier until one quote is accepted, and then only from the others.
 */
const toView = (actor: RfqActor, rfq: Rfq): RfqView => {
    const allQuotes = quotesOf(rfq.rfqId);
    const isCarrier = actor.role === "MANAGER";

    const quotes = isCarrier
        ? allQuotes.filter((quote) => quote.carrierId === actor.carrierId)
        : allQuotes;

    const acceptedQuote = allQuotes.find((quote) => quote.quoteId === rfq.acceptedQuoteId);
    const isAcceptedCarrier = isCarrier && acceptedQuote?.carrierId === actor.carrierId;
    const detailsHidden = isCarrier && rfq.cargoCategory === "VALUABLE" && !isAcceptedCarrier;

    const {description, declaredValueCents, ...rest} = rfq;

    return {
        ...rest,
        ...(!detailsHidden && description !== undefined && {description}),
        ...(!detailsHidden && declaredValueCents !== undefined && {declaredValueCents}),
        detailsHidden,
        quotes,
    };
};

export const createRfq = (
    actor: RfqActor,
    input: CreateRfqInput,
    now: Date = new Date(),
): RfqView => {
    if (actor.role !== "CLIENT") {
        throw new ForbiddenError("Only clients can file an RFQ");
    }

    // An exact, bookable price already exists for these; an RFQ would only
    // make the client wait for a number the calculator can give at once.
    if (CARGO_CATEGORY_SPECS[input.cargoCategory].pricingMode === "INSTANT") {
        throw new BadRequestError(
            `${input.cargoCategory} cargo has an instant price; use POST /api/quotes`,
        );
    }

    // Same eligibility as the calculator: certified for the category, a lane on
    // the route, within the transport type's limits.
    const eligibleCarrierIds = [
        ...new Set(findQuotes(input).map((quote) => quote.carrierId)),
    ];

    if (eligibleCarrierIds.length === 0) {
        throw new BadRequestError("No carrier on the platform can take this shipment");
    }

    const rfq: Rfq = {
        rfqId: randomUUID(),
        clientId: actor.userId,
        fromRegionId: input.fromRegionId,
        toRegionId: input.toRegionId,
        weightKg: input.weightKg,
        volumeM3: input.volumeM3,
        cargoCategory: input.cargoCategory,
        ...(input.transportType !== undefined && {transportType: input.transportType}),
        ...(input.readyDate !== undefined && {readyDate: input.readyDate}),
        ...(input.description !== undefined && {description: input.description}),
        ...(input.declaredValueCents !== undefined && {declaredValueCents: input.declaredValueCents}),
        status: "OPEN",
        eligibleCarrierIds,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + RFQ_TTL_DAYS * DAY_MS).toISOString(),
    };

    rfqsById.set(rfq.rfqId, rfq);

    return toView(actor, rfq);
};

export const listRfqs = (
    actor: RfqActor,
    filter: ListRfqsFilter = {},
    now: Date = new Date(),
): RfqView[] => {
    return [...rfqsById.values()]
        .filter((rfq) => canSee(actor, rfq))
        .map((rfq) => refreshStatus(rfq, now))
        .filter((rfq) => filter.status === undefined || rfq.status === filter.status)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map((rfq) => toView(actor, rfq));
};

export const getRfq = (actor: RfqActor, rfqId: string, now: Date = new Date()): RfqView => {
    return toView(actor, findVisibleRfq(actor, rfqId, now));
};

/** Creates the carrier's quote, or replaces it while the RFQ is still open. */
export const submitQuote = (
    actor: RfqActor,
    rfqId: string,
    input: SubmitRfqQuoteInput,
    now: Date = new Date(),
): RfqView => {
    if (actor.role !== "MANAGER" || actor.carrierId === undefined) {
        throw new ForbiddenError("Only a carrier's manager can quote");
    }

    const rfq = findVisibleRfq(actor, rfqId, now);
    assertOpen(rfq);

    if (Date.parse(input.validUntil) <= now.getTime()) {
        throw new BadRequestError("validUntil must be in the future");
    }

    const existing = quotesOf(rfqId).find((quote) => quote.carrierId === actor.carrierId);
    const quote: RfqQuote = {
        quoteId: existing?.quoteId ?? randomUUID(),
        rfqId,
        carrierId: actor.carrierId,
        priceCents: input.priceCents,
        transitDays: input.transitDays,
        validUntil: input.validUntil,
        ...(input.comment !== undefined && {comment: input.comment}),
        status: "SUBMITTED",
        createdAt: existing?.createdAt ?? now.toISOString(),
        updatedAt: now.toISOString(),
    };

    rfqQuotesById.set(quote.quoteId, quote);

    return toView(actor, rfq);
};

export const acceptQuote = (
    actor: RfqActor,
    rfqId: string,
    quoteId: string,
    now: Date = new Date(),
): RfqView => {
    const rfq = findOwnRfq(actor, rfqId, now);
    assertOpen(rfq);

    const chosen = rfqQuotesById.get(quoteId);

    if (!chosen || chosen.rfqId !== rfqId) {
        throw new NotFoundError("Quote not found on this RFQ");
    }

    if (Date.parse(chosen.validUntil) <= now.getTime()) {
        throw new ConflictError("This quote has passed its validUntil; ask the carrier to re-quote");
    }

    for (const quote of quotesOf(rfqId)) {
        rfqQuotesById.set(quote.quoteId, {
            ...quote,
            status: quote.quoteId === quoteId ? "ACCEPTED" : "DECLINED",
            updatedAt: now.toISOString(),
        });
    }

    const accepted: Rfq = {...rfq, status: "ACCEPTED", acceptedQuoteId: quoteId};
    rfqsById.set(rfqId, accepted);

    return toView(actor, accepted);
};

export const cancelRfq = (actor: RfqActor, rfqId: string, now: Date = new Date()): RfqView => {
    const rfq = findOwnRfq(actor, rfqId, now);
    assertOpen(rfq);

    for (const quote of quotesOf(rfqId)) {
        rfqQuotesById.set(quote.quoteId, {...quote, status: "DECLINED", updatedAt: now.toISOString()});
    }

    const cancelled: Rfq = {...rfq, status: "CANCELLED"};
    rfqsById.set(rfqId, cancelled);

    return toView(actor, cancelled);
};
