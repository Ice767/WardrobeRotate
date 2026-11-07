import {describe, expect, it} from "vitest";

import type {Rfq, Shipment, ShipmentStatus, Tariff} from "../api/types";
import {consoleStats} from "./stats";

const now = new Date("2026-11-20T12:00:00.000Z");

const shipment = (id: string, createdAt: string, priceCents: number, status: ShipmentStatus = "CONFIRMED"): Shipment => ({
    shipmentId: id,
    trackingCode: `FM-${id}`,
    source: "INSTANT",
    carrierId: "c1",
    transportType: "AIR",
    fromRegionId: "a",
    toRegionId: "b",
    priceCents,
    transitDays: 3,
    status,
    createdAt,
});

const rfq = (id: string, quotedBy: string[] = []): Rfq => ({
    rfqId: id,
    fromRegionId: "a",
    toRegionId: "b",
    weightKg: 1,
    volumeM3: 1,
    cargoCategory: "DANGEROUS",
    status: "OPEN",
    eligibleCarrierIds: ["c1", "c2"],
    createdAt: "2026-11-18T00:00:00.000Z",
    expiresAt: "2026-11-25T00:00:00.000Z",
    quotes: quotedBy.map((carrierId) => ({
        quoteId: `${id}-${carrierId}`,
        carrierId,
        transportType: "AIR",
        priceCents: 1,
        transitDays: 1,
        validUntil: "2026-11-25T00:00:00.000Z",
        status: "SUBMITTED",
    })),
});

const tariff = {tariffId: "t1"} as Tariff;

const stats = (shipments: Shipment[], rfqs: Rfq[] = []) =>
    consoleStats({carrierId: "c1", tariffs: [tariff, {...tariff, tariffId: "t2"}], rfqs, shipments, now});

describe("consoleStats", () => {
    it("counts tariffs and the requests this carrier still has to answer", () => {
        const result = stats([], [rfq("r1"), rfq("r2", ["c1"]), rfq("r3", ["c2"])]);

        expect(result.activeTariffs).toBe(2);
        expect(result.requestsToAnswer).toBe(2);
    });

    it("counts shipments that are neither delivered nor cancelled as in progress", () => {
        const result = stats([
            shipment("1", "2026-11-19T00:00:00.000Z", 100, "IN_TRANSIT"),
            shipment("2", "2026-11-19T00:00:00.000Z", 100, "DELIVERED"),
            shipment("3", "2026-11-19T00:00:00.000Z", 100, "CANCELLED"),
            shipment("4", "2026-11-19T00:00:00.000Z", 100, "CONFIRMED"),
        ]);

        expect(result.inProgress).toBe(2);
    });

    it("leaves cancelled shipments out of both money figures", () => {
        const result = stats([
            shipment("1", "2026-11-19T00:00:00.000Z", 500),
            shipment("2", "2026-11-19T00:00:00.000Z", 9_999, "CANCELLED"),
        ]);

        expect(result.bookedThisMonthCents).toBe(500);
        expect(result.weeklyBookingsCents.reduce((sum, cents) => sum + cents, 0)).toBe(500);
    });

    it("keeps last month out of this month but inside the seven weeks", () => {
        const result = stats([shipment("1", "2026-10-25T00:00:00.000Z", 700)]);

        expect(result.bookedThisMonthCents).toBe(0);
        expect(result.weeklyBookingsCents.reduce((sum, cents) => sum + cents, 0)).toBe(700);
    });

    it("gives seven weeks, oldest first, the last one ending now", () => {
        const result = stats([
            shipment("old", "2026-10-03T12:00:00.000Z", 1),
            shipment("new", "2026-11-20T11:00:00.000Z", 2),
            shipment("too-old", "2026-09-01T00:00:00.000Z", 4),
        ]);

        expect(result.weeklyBookingsCents).toHaveLength(7);
        expect(result.weeklyBookingsCents[0]).toBe(1);
        expect(result.weeklyBookingsCents[6]).toBe(2);
    });
});
