import assert from "node:assert/strict";
import {before, describe, it} from "node:test";

import type {BookInstantInput, ShipmentActor} from "../contracts/shipment.contract";
import {carrierIdBySlug, regionIdBySlug, seedReferenceData} from "../data/reference.seed";
import {seedTariffs} from "../data/tariff.seed";
import {BadRequestError, ConflictError, ForbiddenError, NotFoundError} from "../errors/app.error";
import {repos} from "../repositories";
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
    before(async () => {
        seedReferenceData();
        await seedTariffs();
    });

    it("books an instant offer at the server's price", async () => {
        const shipment = await bookShipment(client, instant, NOW);

        assert.equal(shipment.status, "CONFIRMED");
        assert.equal(shipment.priceCents, 100 * 450);
        assert.match(shipment.trackingCode, /^FM-[0-9A-HJKMNP-TV-Z]{8}$/);
        assert.deepEqual(shipment.history.map((e) => e.status), ["CONFIRMED"]);
    });

    it("keeps the booked price when the tariff changes afterwards", async () => {
        const shipment = await bookShipment(client, instant, NOW);
        const tariff = await repos().tariffs.findByLane({carrierId: AERO, fromRegionId: instant.fromRegionId, toRegionId: instant.toRegionId, transportType: "AIR"});
        assert.ok(tariff);
        await repos().tariffs.updatePrices(tariff.tariffId, {...tariff, pricePerKgCents: 9_999});

        assert.equal((await getShipment(client, shipment.shipmentId)).priceCents, 100 * 450);
        await repos().tariffs.updatePrices(tariff.tariffId, tariff);
    });

    it("refuses an instant booking for cargo that has no bookable price", async () => {
        await assert.rejects(bookShipment(client, {...instant, cargoCategory: "DANGEROUS"}, NOW), BadRequestError);
    });

    it("refuses a carrier that has no offer on the route", async () => {
        await assert.rejects(bookShipment(client, {...instant, carrierId: SEA}, NOW), BadRequestError);
    });

    it("books an accepted RFQ once, with the quoted price and transport", async () => {
        const rfq = await createRfq(client, {
            fromRegionId: regionIdBySlug("il-asd"),
            toRegionId: regionIdBySlug("us-hou"),
            weightKg: 2_000,
            volumeM3: 20,
            cargoCategory: "DANGEROUS",
            description: "UN1263 paint",
        }, NOW);

        await assert.rejects(bookShipment(client, {source: "RFQ", rfqId: rfq.rfqId}, NOW), ConflictError);

        const quoteId = (await submitQuote(seaManager, rfq.rfqId, {
            transportType: "SEA", priceCents: 300_000, transitDays: 28, validUntil: "2026-11-05T00:00:00.000Z",
        }, NOW)).quotes[0]!.quoteId;
        await acceptQuote(client, rfq.rfqId, quoteId, NOW);

        const shipment = await bookShipment(client, {source: "RFQ", rfqId: rfq.rfqId}, NOW);

        assert.equal(shipment.carrierId, SEA);
        assert.equal(shipment.transportType, "SEA");
        assert.equal(shipment.priceCents, 300_000);
        assert.equal(shipment.description, "UN1263 paint");
        await assert.rejects(bookShipment(client, {source: "RFQ", rfqId: rfq.rfqId}, NOW), ConflictError);
    });

    it("lets the carrier move it through to delivery, recording each step", async () => {
        const shipment = await bookShipment(client, instant, NOW);

        await changeStatus(aeroManager, shipment.shipmentId, "PICKED_UP", "Collected at TLV cargo terminal", NOW);
        await changeStatus(aeroManager, shipment.shipmentId, "IN_TRANSIT", undefined, NOW);
        const delivered = await changeStatus(aeroManager, shipment.shipmentId, "DELIVERED", undefined, NOW);

        assert.deepEqual(delivered.history.map((e) => e.status), ["CONFIRMED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"]);
        assert.equal(delivered.history[1]?.note, "Collected at TLV cargo terminal");
        assert.equal((await getShipment(client, shipment.shipmentId)).status, "DELIVERED");
    });

    it("applies only one of two racing status changes", async () => {
        const shipment = await bookShipment(client, instant, NOW);

        const results = await Promise.allSettled([
            changeStatus(aeroManager, shipment.shipmentId, "PICKED_UP", undefined, NOW),
            changeStatus(client, shipment.shipmentId, "CANCELLED", undefined, NOW),
        ]);

        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        assert.equal((await getShipment(client, shipment.shipmentId)).history.length, 2);
    });

    it("lets the client cancel before pickup but not after", async () => {
        const early = await bookShipment(client, instant, NOW);
        assert.equal((await changeStatus(client, early.shipmentId, "CANCELLED", undefined, NOW)).status, "CANCELLED");

        const late = await bookShipment(client, instant, NOW);
        await changeStatus(aeroManager, late.shipmentId, "PICKED_UP", undefined, NOW);
        await assert.rejects(changeStatus(client, late.shipmentId, "CANCELLED", undefined, NOW), ConflictError);
    });

    it("does not let the client report progress", async () => {
        const shipment = await bookShipment(client, instant, NOW);

        await assert.rejects(changeStatus(client, shipment.shipmentId, "PICKED_UP", undefined, NOW), ForbiddenError);
    });

    it("hides shipments from other clients and other carriers", async () => {
        const shipment = await bookShipment(client, instant, NOW);

        await assert.rejects(getShipment(otherClient, shipment.shipmentId), NotFoundError);
        await assert.rejects(getShipment(seaManager, shipment.shipmentId), NotFoundError);
        await assert.rejects(changeStatus(seaManager, shipment.shipmentId, "PICKED_UP", undefined, NOW), NotFoundError);
        assert.ok((await listShipments(seaManager)).every((s) => s.carrierId === SEA));
    });

    it("lets anyone track by code without seeing price, client or contents", async () => {
        const shipment = await bookShipment(client, {...instant, description: "Spare parts"}, NOW);
        await changeStatus(aeroManager, shipment.shipmentId, "PICKED_UP", "Private note", NOW);

        const tracking = await trackShipment(shipment.trackingCode.toLowerCase());

        assert.equal(tracking.status, "PICKED_UP");
        assert.deepEqual(Object.keys(tracking).sort(), ["fromRegionId", "history", "status", "toRegionId", "trackingCode", "transportType"]);
        assert.deepEqual(Object.keys(tracking.history[1]!).sort(), ["at", "status"]);
        await assert.rejects(trackShipment("FM-00000000"), NotFoundError);
    });
});
