import assert from "node:assert/strict";
import {before, describe, it} from "node:test";

import type {QuoteRequest} from "../contracts/quote.contract";
import {carrierIdBySlug, regionIdBySlug, seedReferenceData} from "../data/reference.seed";
import {seedTariffs} from "../data/tariff.seed";
import {BadRequestError} from "../errors/app.error";
import {repos} from "../repositories";
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

const airQuoteFrom = async (pending: ReturnType<typeof findQuotes>) => {
    const quote = (await pending).find((q) => q.carrierId === AERO && q.transportType === "AIR");
    assert.ok(quote, "expected an AeroFreight AIR quote");
    return quote;
};

describe("findQuotes", () => {
    before(async () => {
        seedReferenceData();
        await seedTariffs();
    });

    it("uses the city-to-city lane when one exists", async () => {
        const quote = await airQuoteFrom(findQuotes(request({})));

        assert.equal(quote.matchedFromRegionId, regionIdBySlug("il-tlv"));
        assert.equal(quote.matchedToRegionId, regionIdBySlug("us-chi"));
        assert.equal(quote.priceCents, 100 * 450);
    });

    it("falls back to the country lane when no narrower one exists", async () => {
        const quote = await airQuoteFrom(findQuotes(request({toRegionId: regionIdBySlug("us-nyc")})));

        assert.equal(quote.matchedFromRegionId, regionIdBySlug("il"));
        assert.equal(quote.matchedToRegionId, regionIdBySlug("us"));
        assert.equal(quote.priceCents, 100 * 520);
    });

    it("falls back across both ends at once", async () => {
        const quote = await airQuoteFrom(findQuotes(request({
            fromRegionId: regionIdBySlug("il-hfa"),
            toRegionId: regionIdBySlug("us-mia"),
        })));

        assert.equal(quote.matchedFromRegionId, regionIdBySlug("il"));
    });

    it("returns a range, not a price, for indicative categories", async () => {
        const quote = await airQuoteFrom(findQuotes(request({cargoCategory: "DANGEROUS"})));

        assert.equal(quote.pricingMode, "INDICATIVE");
        assert.equal(quote.priceCents, undefined);
        assert.deepEqual(quote.priceRangeCents, {min: Math.ceil(45_000 * 1.25), max: Math.ceil(45_000 * 1.75)});
    });

    it("returns no figure at all for on-request categories", async () => {
        const quote = await airQuoteFrom(findQuotes(request({cargoCategory: "VALUABLE"})));

        assert.equal(quote.pricingMode, "ON_REQUEST");
        assert.equal(quote.priceCents, undefined);
        assert.equal(quote.priceRangeCents, undefined);
        assert.equal(quote.breakdown, undefined);
    });

    it("leaves out carriers not certified for the category", async () => {
        const quotes = await findQuotes(request({
            fromRegionId: regionIdBySlug("il-asd"),
            toRegionId: regionIdBySlug("us-hou"),
            cargoCategory: "LIVE_ANIMALS",
            transportType: "SEA",
        }));

        assert.deepEqual(quotes, []);
    });

    it("leaves out transport types whose limits the shipment exceeds", async () => {
        assert.deepEqual(await findQuotes(request({weightKg: 6_000, transportType: "AIR"})), []);
    });

    it("rejects an unknown region", async () => {
        await assert.rejects(findQuotes(request({toRegionId: "00000000-0000-4000-8000-000000000000"})), BadRequestError);
    });

    // Last: reprices the seeded tariff.
    it("keeps the narrow lane even when it is the more expensive one", async () => {
        const narrow = await repos().tariffs.findByLane({
            carrierId: AERO,
            fromRegionId: regionIdBySlug("il-tlv"),
            toRegionId: regionIdBySlug("us-chi"),
            transportType: "AIR",
        });
        assert.ok(narrow);
        await repos().tariffs.updatePrices(narrow.tariffId, {...narrow, pricePerKgCents: 900});

        const quote = await airQuoteFrom(findQuotes(request({})));

        assert.equal(quote.matchedToRegionId, regionIdBySlug("us-chi"));
        assert.equal(quote.priceCents, 100 * 900);
    });
});
