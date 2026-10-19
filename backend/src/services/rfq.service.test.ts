import assert from "node:assert/strict";
import {before, describe, it} from "node:test";

import type {CreateRfqInput, RfqActor} from "../contracts/rfq.contract";
import {carrierIdBySlug, regionIdBySlug, seedReferenceData} from "../data/reference.seed";
import {seedTariffs} from "../data/tariff.seed";
import {BadRequestError, ConflictError, ForbiddenError, NotFoundError} from "../errors/app.error";
import {acceptQuote, cancelRfq, createRfq, getRfq, listRfqs, submitQuote} from "./rfq.service";

const AERO = carrierIdBySlug("aerofreight");
const SEA = carrierIdBySlug("seatransline");

const client: RfqActor = {userId: "client-1", role: "CLIENT"};
const otherClient: RfqActor = {userId: "client-2", role: "CLIENT"};
const aeroManager: RfqActor = {userId: "m-aero", role: "MANAGER", carrierId: AERO};
const seaManager: RfqActor = {userId: "m-sea", role: "MANAGER", carrierId: SEA};
const transManager: RfqActor = {userId: "m-trans", role: "MANAGER", carrierId: carrierIdBySlug("translogistic")};
const admin: RfqActor = {userId: "admin", role: "ADMIN"};

const NOW = new Date("2026-11-01T00:00:00.000Z");
const IN_8_DAYS = new Date("2026-11-09T00:00:00.000Z");
const VALID_UNTIL = "2026-11-05T00:00:00.000Z";

// Two carriers can take this one: SeaTransLine by sea and AeroFreight by air.
const dangerousToHouston: CreateRfqInput = {
    fromRegionId: regionIdBySlug("il-asd"),
    toRegionId: regionIdBySlug("us-hou"),
    weightKg: 2_000,
    volumeM3: 20,
    cargoCategory: "DANGEROUS",
    description: "UN1263 paint, 40 drums",
};

const valuableToChicago: CreateRfqInput = {
    fromRegionId: regionIdBySlug("il-tlv"),
    toRegionId: regionIdBySlug("us-chi"),
    weightKg: 5,
    volumeM3: 0.01,
    cargoCategory: "VALUABLE",
    description: "Diamonds, 3 parcels",
    declaredValueCents: 250_000_000,
};

const quote = (priceCents: number, transportType: "SEA" | "AIR" = "SEA") => ({
    transportType,
    priceCents,
    transitDays: 5,
    validUntil: VALID_UNTIL,
});

describe("RFQ", () => {
    before(() => {
        seedReferenceData();
        seedTariffs();
    });

    it("refuses categories that already have an instant price", () => {
        assert.throws(() => createRfq(client, {...dangerousToHouston, cargoCategory: "GENERAL"}, NOW), BadRequestError);
    });

    it("refuses a shipment no carrier can take", () => {
        assert.throws(
            () => createRfq(client, {...dangerousToHouston, cargoCategory: "LIVE_ANIMALS", transportType: "SEA"}, NOW),
            BadRequestError,
        );
    });

    it("invites exactly the carriers the calculator finds eligible", () => {
        const rfq = createRfq(client, dangerousToHouston, NOW);

        assert.deepEqual(new Set(rfq.eligibleCarrierIds), new Set([AERO, SEA]));
        assert.equal(rfq.status, "OPEN");
    });

    it("is invisible to other clients and to carriers that were not invited", () => {
        const rfq = createRfq(client, dangerousToHouston, NOW);

        assert.throws(() => getRfq(otherClient, rfq.rfqId, NOW), NotFoundError);
        assert.throws(() => getRfq(transManager, rfq.rfqId, NOW), NotFoundError);
        assert.equal(getRfq(seaManager, rfq.rfqId, NOW).rfqId, rfq.rfqId);
        assert.equal(getRfq(admin, rfq.rfqId, NOW).rfqId, rfq.rfqId);
    });

    it("shows each carrier only its own quote, and the client all of them", () => {
        const rfq = createRfq(client, dangerousToHouston, NOW);
        submitQuote(seaManager, rfq.rfqId, quote(300_000), NOW);
        submitQuote(aeroManager, rfq.rfqId, quote(1_900_000, "AIR"), NOW);

        const seen = getRfq(seaManager, rfq.rfqId, NOW).quotes;
        assert.equal(seen.length, 1);
        assert.equal(seen[0]?.carrierId, SEA);

        const all = getRfq(client, rfq.rfqId, NOW).quotes;
        assert.deepEqual(all.map((q) => q.priceCents), [300_000, 1_900_000]);
    });

    it("lets a carrier revise its quote instead of adding a second one", () => {
        const rfq = createRfq(client, dangerousToHouston, NOW);
        submitQuote(seaManager, rfq.rfqId, quote(300_000), NOW);
        submitQuote(seaManager, rfq.rfqId, quote(280_000), NOW);

        const quotes = getRfq(client, rfq.rfqId, NOW).quotes;
        assert.equal(quotes.length, 1);
        assert.equal(quotes[0]?.priceCents, 280_000);
    });

    it("hides valuable-cargo details from carriers until their quote is accepted", () => {
        const rfq = createRfq(client, valuableToChicago, NOW);

        const before = getRfq(aeroManager, rfq.rfqId, NOW);
        assert.equal(before.detailsHidden, true);
        assert.equal(before.description, undefined);
        assert.equal(before.declaredValueCents, undefined);

        assert.equal(getRfq(client, rfq.rfqId, NOW).description, "Diamonds, 3 parcels");

        const submitted = submitQuote(aeroManager, rfq.rfqId, quote(900_000, "AIR"), NOW);
        acceptQuote(client, rfq.rfqId, submitted.quotes[0]!.quoteId, NOW);

        const after = getRfq(aeroManager, rfq.rfqId, NOW);
        assert.equal(after.detailsHidden, false);
        assert.equal(after.declaredValueCents, 250_000_000);
    });

    it("does not hide details of non-valuable cargo — the carrier needs them to price", () => {
        const rfq = createRfq(client, dangerousToHouston, NOW);

        assert.equal(getRfq(seaManager, rfq.rfqId, NOW).description, "UN1263 paint, 40 drums");
    });

    it("accepts one quote, declines the rest and closes the RFQ", () => {
        const rfq = createRfq(client, dangerousToHouston, NOW);
        const seaQuoteId = submitQuote(seaManager, rfq.rfqId, quote(300_000), NOW).quotes[0]!.quoteId;
        submitQuote(aeroManager, rfq.rfqId, quote(1_900_000, "AIR"), NOW);

        const accepted = acceptQuote(client, rfq.rfqId, seaQuoteId, NOW);

        assert.equal(accepted.status, "ACCEPTED");
        assert.equal(accepted.acceptedQuoteId, seaQuoteId);
        assert.deepEqual(
            accepted.quotes.map((q) => [q.carrierId, q.status]),
            [[SEA, "ACCEPTED"], [AERO, "DECLINED"]],
        );
        assert.throws(() => submitQuote(aeroManager, rfq.rfqId, quote(1_000, "AIR"), NOW), ConflictError);
    });

    it("refuses to accept a quote past its validUntil", () => {
        const rfq = createRfq(client, dangerousToHouston, NOW);
        const quoteId = submitQuote(seaManager, rfq.rfqId, quote(300_000), NOW).quotes[0]!.quoteId;

        assert.throws(
            () => acceptQuote(client, rfq.rfqId, quoteId, new Date("2026-11-06T00:00:00.000Z")),
            ConflictError,
        );
    });

    it("expires on read once its deadline has passed", () => {
        const rfq = createRfq(client, dangerousToHouston, NOW);

        assert.equal(getRfq(client, rfq.rfqId, IN_8_DAYS).status, "EXPIRED");
        assert.throws(() => submitQuote(seaManager, rfq.rfqId, quote(300_000), IN_8_DAYS), ConflictError);
    });

    it("refuses a transport type the carrier does not run or the client excluded", () => {
        const rfq = createRfq(client, dangerousToHouston, NOW);
        assert.throws(() => submitQuote(seaManager, rfq.rfqId, quote(300_000, "AIR"), NOW), BadRequestError);

        const seaOnly = createRfq(client, {...dangerousToHouston, transportType: "SEA"}, NOW);
        assert.throws(() => submitQuote(aeroManager, seaOnly.rfqId, quote(1_900_000, "AIR"), NOW), NotFoundError);
    });

    it("lets only the filing client accept or cancel", () => {
        const rfq = createRfq(client, dangerousToHouston, NOW);
        const quoteId = submitQuote(seaManager, rfq.rfqId, quote(300_000), NOW).quotes[0]!.quoteId;

        assert.throws(() => acceptQuote(seaManager, rfq.rfqId, quoteId, NOW), ForbiddenError);
        assert.throws(() => cancelRfq(otherClient, rfq.rfqId, NOW), NotFoundError);
    });

    it("cancels an open RFQ and declines its quotes", () => {
        const rfq = createRfq(client, dangerousToHouston, NOW);
        submitQuote(seaManager, rfq.rfqId, quote(300_000), NOW);

        const cancelled = cancelRfq(client, rfq.rfqId, NOW);

        assert.equal(cancelled.status, "CANCELLED");
        assert.equal(cancelled.quotes[0]?.status, "DECLINED");
    });

    it("lists only what the viewer may see", () => {
        const ids = listRfqs(transManager, {}, NOW).map((r) => r.rfqId);
        assert.deepEqual(ids, []);
        assert.ok(listRfqs(otherClient, {}, NOW).length === 0);
        assert.ok(listRfqs(client, {status: "OPEN"}, NOW).every((r) => r.status === "OPEN"));
    });
});
