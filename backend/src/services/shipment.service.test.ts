import assert from "node:assert/strict";
import {before, describe, it} from "node:test";

import type {BookInstantInput, ShipmentActor} from "../contracts/shipment.contract";
import {carrierIdBySlug, regionIdBySlug, seedReferenceData} from "../data/reference.seed";
import {tariffsById} from "../data/store";
import {seedTariffs} from "../data/tariff.seed";
import {BadRequestError, ConflictError, ForbiddenError, NotFoundError} from "../errors/app.error";
import {acceptQuote, createRfq, submitQuote} from "./rfq.service";
import {bookShipment, changeStatus, getShipment, listShipments, trackShipment} from "./shipment.service";

const AERO = carrierIdBySlug("aerofreight");
const SEA = carrierIdBySlug("seatransline");

const client: ShipmentActor = {userId: "client-1", role: "CLIENT"};
const otherClient: ShipmentActor = {userId: "client-2", role: "CLIENT"};
const aeroManager: ShipmentActor = {userId: "m-aero", role: "MANAGER", carrierId: AERO};
const seaManager: ShipmentActor = {userId: "m-sea", role: "MANAGER", carrierId: SEA};

const NOW = new Date("2026-11-01T00:00:00.000Z");

const instant: BookInstantInput = {
    source: "INSTANT",
    carrierId: AERO,
    transportType: "AIR",
    fromRegionId: regionIdBySlug("il-tlv"),
    toRegionId: regionIdBySlug("us-chi"),
    weightKg: 100,
    volumeM3: 0.2,
    cargoCategory: "GENERAL",
};

describe("shipments", () => {
    before(() => {
        seedReferenceData();
        seedTariffs();
    });

    it("books an instant offer at the server's price", () => {
        const shipment = bookShipment(client, instant, NOW);

        assert.equal(shipment.status, "CONFIRMED");
        assert.equal(shipment.priceCents, 100 * 450);
        assert.match(shipment.trackingCode, /^FM-[0-9A-HJKMNP-TV-Z]{8}$/);
        assert.deepEqual(shipment.history.map((e) => e.status), ["CONFIRMED"]);
    });

    it("keeps the booked price when the tariff changes afterwards", () => {
        const shipment = bookShipment(client, instant, NOW);
        const tariff = [...tariffsById.values()].find((t) => t.carrierId === AERO && t.fromRegionId === instant.fromRegionId);
        assert.ok(tariff);
        tariffsById.set(tariff.tariffId, {...tariff, pricePerKgCents: 9_999});

        assert.equal(getShipment(client, shipment.shipmentId).priceCents, 100 * 450);
        tariffsById.set(tariff.tariffId, tariff);
    });

    it("refuses an instant booking for cargo that has no bookable price", () => {
        assert.throws(() => bookShipment(client, {...instant, cargoCategory: "DANGEROUS"}, NOW), BadRequestError);
    });

    it("refuses a carrier that has no offer on the route", () => {
        assert.throws(() => bookShipment(client, {...instant, carrierId: SEA}, NOW), BadRequestError);
    });

    it("books an accepted RFQ once, with the quoted price and transport", () => {
        const rfq = createRfq(client, {
            fromRegionId: regionIdBySlug("il-asd"),
            toRegionId: regionIdBySlug("us-hou"),
            weightKg: 2_000,
            volumeM3: 20,
            cargoCategory: "DANGEROUS",
            description: "UN1263 paint",
        }, NOW);

        assert.throws(() => bookShipment(client, {source: "RFQ", rfqId: rfq.rfqId}, NOW), ConflictError);

        const quoteId = submitQuote(seaManager, rfq.rfqId, {
            transportType: "SEA", priceCents: 300_000, transitDays: 28, validUntil: "2026-11-05T00:00:00.000Z",
        }, NOW).quotes[0]!.quoteId;
        acceptQuote(client, rfq.rfqId, quoteId, NOW);

        const shipment = bookShipment(client, {source: "RFQ", rfqId: rfq.rfqId}, NOW);

        assert.equal(shipment.carrierId, SEA);
        assert.equal(shipment.transportType, "SEA");
        assert.equal(shipment.priceCents, 300_000);
        assert.equal(shipment.description, "UN1263 paint");
        assert.throws(() => bookShipment(client, {source: "RFQ", rfqId: rfq.rfqId}, NOW), ConflictError);
    });

    it("lets the carrier move it through to delivery, recording each step", () => {
        const shipment = bookShipment(client, instant, NOW);

        changeStatus(aeroManager, shipment.shipmentId, "PICKED_UP", "Collected at TLV cargo terminal", NOW);
        changeStatus(aeroManager, shipment.shipmentId, "IN_TRANSIT", undefined, NOW);
        const delivered = changeStatus(aeroManager, shipment.shipmentId, "DELIVERED", undefined, NOW);

        assert.deepEqual(delivered.history.map((e) => e.status), ["CONFIRMED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"]);
        assert.equal(delivered.history[1]?.note, "Collected at TLV cargo terminal");
    });

    it("lets the client cancel before pickup but not after", () => {
        const early = bookShipment(client, instant, NOW);
        assert.equal(changeStatus(client, early.shipmentId, "CANCELLED", undefined, NOW).status, "CANCELLED");

        const late = bookShipment(client, instant, NOW);
        changeStatus(aeroManager, late.shipmentId, "PICKED_UP", undefined, NOW);
        assert.throws(() => changeStatus(client, late.shipmentId, "CANCELLED", undefined, NOW), ConflictError);
    });

    it("does not let the client report progress", () => {
        const shipment = bookShipment(client, instant, NOW);

        assert.throws(() => changeStatus(client, shipment.shipmentId, "PICKED_UP", undefined, NOW), ForbiddenError);
    });

    it("hides shipments from other clients and other carriers", () => {
        const shipment = bookShipment(client, instant, NOW);

        assert.throws(() => getShipment(otherClient, shipment.shipmentId), NotFoundError);
        assert.throws(() => getShipment(seaManager, shipment.shipmentId), NotFoundError);
        assert.throws(() => changeStatus(seaManager, shipment.shipmentId, "PICKED_UP", undefined, NOW), NotFoundError);
        assert.ok(listShipments(seaManager).every((s) => s.carrierId === SEA));
    });

    it("lets anyone track by code without seeing price, client or contents", () => {
        const shipment = bookShipment(client, {...instant, description: "Spare parts"}, NOW);
        changeStatus(aeroManager, shipment.shipmentId, "PICKED_UP", "Private note", NOW);

        const tracking = trackShipment(shipment.trackingCode.toLowerCase());

        assert.equal(tracking.status, "PICKED_UP");
        assert.deepEqual(Object.keys(tracking).sort(), ["fromRegionId", "history", "status", "toRegionId", "trackingCode", "transportType"]);
        assert.deepEqual(Object.keys(tracking.history[1]!).sort(), ["at", "status"]);
        assert.throws(() => trackShipment("FM-00000000"), NotFoundError);
    });
});
