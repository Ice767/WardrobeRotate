import {describe, expect, it} from "vitest";

import type {Quote, Region} from "../api/types";
import {countryOf, describeBasis, formatCents, formatRange, pickHighlights} from "./format";

const quote = (over: Partial<Quote>): Quote => ({
    carrierId: "c",
    carrierName: "Carrier",
    transportType: "AIR",
    transitDays: 4,
    pricingMode: "INSTANT",
    matchedFromRegionId: "a",
    matchedToRegionId: "b",
    ...over,
});

describe("format", () => {
    it("turns cents into dollars only for display", () => {
        expect(formatCents(180_000)).toBe("$1,800.00");
        expect(formatRange({min: 56_250, max: 78_750})).toBe("$562.50 – $787.50");
    });

    it("explains what decided the price", () => {
        expect(describeBasis(quote({breakdown: {basis: "VOLUME", chargeableWeightKg: 20_000}}), 20)).toBe("Billed by volume: 20 m³");
        expect(describeBasis(quote({breakdown: {basis: "WEIGHT", chargeableWeightKg: 3340}}), 20)).toBe("Billed by weight: 3,340 kg chargeable");
        expect(describeBasis(quote({}), 20)).toBeNull();
    });

    it("marks the fastest offer only when it is not also the cheapest", () => {
        const sea = quote({carrierId: "sea", priceCents: 180_000, transitDays: 28});
        const air = quote({carrierId: "air", priceCents: 1_736_800, transitDays: 6});

        expect(pickHighlights([sea, air])).toEqual({cheapest: sea, fastest: air});
        expect(pickHighlights([air])).toEqual({});
        expect(pickHighlights([quote({priceCents: 100, transitDays: 2}), quote({priceCents: 200, transitDays: 3})]).fastest).toBeUndefined();
    });

    it("finds a region's country through any depth of hierarchy", () => {
        const il: Region = {regionId: "il", name: "Israel", code: "IL", level: "COUNTRY", parentId: null};
        const ta: Region = {regionId: "ta", name: "Tel Aviv District", code: "IL-TA", level: "REGION", parentId: "il"};
        const tlv: Region = {regionId: "tlv", name: "Tel Aviv", code: "TLV", level: "CITY", parentId: "ta"};
        const byId = new Map([il, ta, tlv].map((r) => [r.regionId, r]));

        expect(countryOf(tlv, byId).name).toBe("Israel");
        expect(countryOf(il, byId).name).toBe("Israel");
    });
});
