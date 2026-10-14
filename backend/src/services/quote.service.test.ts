import assert from "node:assert/strict";
import {before, describe, it} from "node:test";

import type {QuoteRequest} from "../contracts/quote.contract";
import {carrierIdBySlug, regionIdBySlug, seedReferenceData} from "../data/reference.seed";
import {tariffsById} from "../data/store";
import {seedTariffs} from "../data/tariff.seed";
import {BadRequestError} from "../errors/app.error";
import {findQuotes} from "./quote.service";

const AERO = carrierIdBySlug("aerofreight");

const request = (overrides: Partial<QuoteRequest>): QuoteRequest => ({
    fromRegionId: regionIdBySlug("il-tlv"),
    toRegionId: regionIdBySlug("us-chi"),
    weightKg: 100,
    volumeM3: 0.2,
    cargoCategory: "GENERAL",
    ...overrides,
});

const airQuoteFrom = (quotes: ReturnType<typeof findQuotes>) => {
    const quote = quotes.find((q) => q.carrierId === AERO && q.transportType === "AIR");
    assert.ok(quote, "expected an AeroFreight AIR quote");
    return quote;
};

describe("findQuotes", () => {
    before(() => {
        seedReferenceData();
        seedTariffs();
    });

    it("uses the city-to-city lane when one exists", () => {
        const quote = airQuoteFrom(findQuotes(request({})));

        assert.equal(quote.matchedFromRegionId, regionIdBySlug("il-tlv"));
        assert.equal(quote.matchedToRegionId, regionIdBySlug("us-chi"));
        assert.equal(quote.priceCents, 100 * 450);
    });

    it("falls back to the country lane when no narrower one exists", () => {
        const quote = airQuoteFrom(findQuotes(request({toRegionId: regionIdBySlug("us-nyc")})));

        assert.equal(quote.matchedFromRegionId, regionIdBySlug("il"));
        assert.equal(quote.matchedToRegionId, regionIdBySlug("us"));
        assert.equal(quote.priceCents, 100 * 520);
    });

    it("falls back across both ends at once", () => {
        const quote = airQuoteFrom(findQuotes(request({
            fromRegionId: regionIdBySlug("il-hfa"),
            toRegionId: regionIdBySlug("us-mia"),
        })));

        assert.equal(quote.matchedFromRegionId, regionIdBySlug("il"));
    });

    it("returns a range, not a price, for indicative categories", () => {
        const quote = airQuoteFrom(findQuotes(request({cargoCategory: "DANGEROUS"})));

        assert.equal(quote.pricingMode, "INDICATIVE");
        assert.equal(quote.priceCents, undefined);
        assert.deepEqual(quote.priceRangeCents, {
            min: Math.ceil(45_000 * 1.25),
            max: Math.ceil(45_000 * 1.75),
        });
    });

    it("returns no figure at all for on-request categories", () => {
        const quote = airQuoteFrom(findQuotes(request({cargoCategory: "VALUABLE"})));

        assert.equal(quote.pricingMode, "ON_REQUEST");
        assert.equal(quote.priceCents, undefined);
        assert.equal(quote.priceRangeCents, undefined);
        assert.equal(quote.breakdown, undefined);
    });

    it("leaves out carriers not certified for the category", () => {
        const quotes = findQuotes(request({
            fromRegionId: regionIdBySlug("il-asd"),
            toRegionId: regionIdBySlug("us-hou"),
            cargoCategory: "LIVE_ANIMALS",
            transportType: "SEA",
        }));

        assert.deepEqual(quotes, []);
    });

    it("leaves out transport types whose limits the shipment exceeds", () => {
        const quotes = findQuotes(request({weightKg: 6_000, transportType: "AIR"}));

        assert.deepEqual(quotes, []);
    });

    it("rejects an unknown region", () => {
        assert.throws(
            () => findQuotes(request({toRegionId: "00000000-0000-4000-8000-000000000000"})),
            BadRequestError,
        );
    });

    // Last: mutates the seeded tariff.
    it("keeps the narrow lane even when it is the more expensive one", () => {
        const narrow = [...tariffsById.values()].find(
            (t) => t.carrierId === AERO && t.fromRegionId === regionIdBySlug("il-tlv"),
        );
        assert.ok(narrow);
        tariffsById.set(narrow.tariffId, {...narrow, pricePerKgCents: 900});

        const quote = airQuoteFrom(findQuotes(request({})));

        assert.equal(quote.matchedToRegionId, regionIdBySlug("us-chi"));
        assert.equal(quote.priceCents, 100 * 900);
    });
});
