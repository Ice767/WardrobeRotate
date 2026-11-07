import {describe, expect, it} from "vitest";

import type {Rfq, Shipment, Tariff} from "../api/types";
import {searchConsole} from "./search";

const names: Record<string, string> = {asd: "Ashdod", hou: "Houston", hfa: "Haifa"};
const regionName = (id: string) => names[id] ?? "?";

const tariffs: Tariff[] = [
    {tariffId: "t1", carrierId: "c1", fromRegionId: "asd", toRegionId: "hou", transportType: "AIR", pricePerKgCents: 520, pricePerM3Cents: 0, minChargeCents: 0, transitDays: 6},
    {tariffId: "t2", carrierId: "c1", fromRegionId: "asd", toRegionId: "hfa", transportType: "TRUCK", pricePerKgCents: 90, pricePerM3Cents: 0, minChargeCents: 0, transitDays: 1},
];

const rfqs: Rfq[] = [
    {
        rfqId: "4f1c9a2b-0000-4000-8000-000000000000",
        fromRegionId: "hfa",
        toRegionId: "asd",
        weightKg: 10,
        volumeM3: 1,
        cargoCategory: "DANGEROUS",
        status: "OPEN",
        eligibleCarrierIds: ["c1"],
        createdAt: "2026-11-01T00:00:00.000Z",
        expiresAt: "2026-11-10T00:00:00.000Z",
        quotes: [],
    },
];

const shipments: Shipment[] = [
    {
        shipmentId: "s1",
        trackingCode: "FM-6FFZNQWE",
        source: "INSTANT",
        carrierId: "c1",
        transportType: "AIR",
        fromRegionId: "asd",
        toRegionId: "hou",
        priceCents: 100,
        transitDays: 6,
        status: "IN_TRANSIT",
        createdAt: "2026-11-01T00:00:00.000Z",
    },
];

const data = {tariffs, rfqs, shipments, regionName};

describe("searchConsole", () => {
    it("finds nothing for an empty or blank query", () => {
        expect(searchConsole("", data)).toEqual([]);
        expect(searchConsole("   ", data)).toEqual([]);
    });

    it("finds a tariff and a shipment by a city on their route", () => {
        const hits = searchConsole("houston", data);

        expect(hits.map((hit) => hit.kind)).toEqual(["Tariff", "Shipment"]);
        expect(hits[0]).toMatchObject({title: "AIR · $5.20 / kg", sub: "Ashdod → Houston", to: "/console/tariffs?focus=t1"});
        expect(hits[1]).toMatchObject({title: "FM-6FFZNQWE", to: "/console/shipments?focus=s1"});
    });

    it("finds a shipment by part of its tracking code in any case", () => {
        expect(searchConsole("fm-6ffz", data).map((hit) => hit.id)).toEqual(["s1"]);
    });

    it("finds a request by its short id", () => {
        expect(searchConsole("rfq-4f1c", data)).toMatchObject([{kind: "Request", title: "RFQ-4F1C9A2B", to: "/console/requests?focus=4f1c9a2b-0000-4000-8000-000000000000"}]);
    });

    it("treats regex characters as plain text", () => {
        expect(() => searchConsole("(", data)).not.toThrow();
        expect(searchConsole("(", data)).toEqual([]);
        expect(searchConsole(".*", data)).toEqual([]);
    });

    it("lists tariffs, then requests, then shipments", () => {
        const kinds = searchConsole("ashdod", data).map((hit) => hit.kind);

        expect(kinds).toEqual(["Tariff", "Tariff", "Request", "Shipment"]);
    });
});
