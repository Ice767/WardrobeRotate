import {describe, expect, it} from "vitest";

import type {Rfq} from "../api/types";
import {requestState} from "./requests";

const rfq = (overrides: Partial<Rfq> = {}): Rfq => ({
    rfqId: "r1",
    fromRegionId: "a",
    toRegionId: "b",
    weightKg: 100,
    volumeM3: 1,
    cargoCategory: "DANGEROUS",
    status: "OPEN",
    eligibleCarrierIds: ["c1", "c2"],
    createdAt: "2026-11-01T00:00:00.000Z",
    expiresAt: "2026-11-10T00:00:00.000Z",
    quotes: [],
    ...overrides,
});

const now = new Date("2026-11-05T00:00:00.000Z");

describe("requestState", () => {
    it("is open while nobody from this carrier answered", () => {
        expect(requestState(rfq(), "c1", now)).toBe("open");
    });

    it("is answered once this carrier sent a price", () => {
        const answered = rfq({
            quotes: [{quoteId: "q1", carrierId: "c1", transportType: "AIR", priceCents: 1, transitDays: 1, validUntil: "2026-11-10T00:00:00.000Z", status: "SUBMITTED"}],
        });

        expect(requestState(answered, "c1", now)).toBe("answered");
        expect(requestState(answered, "c2", now)).toBe("open");
    });

    it("is closed once the client accepted or cancelled", () => {
        expect(requestState(rfq({status: "ACCEPTED"}), "c1", now)).toBe("closed");
        expect(requestState(rfq({status: "CANCELLED"}), "c1", now)).toBe("closed");
    });

    it("is closed one second past expiry even if the server still says OPEN", () => {
        expect(requestState(rfq(), "c1", new Date("2026-11-10T00:00:01.000Z"))).toBe("closed");
    });
});
