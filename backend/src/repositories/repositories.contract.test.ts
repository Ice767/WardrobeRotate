import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {after, before, describe, it} from "node:test";

import pg from "pg";

import type {StoredUser} from "../contracts/auth.contract";
import type {Carrier} from "../contracts/carrier.contract";
import type {Rfq, RfqQuote} from "../contracts/rfq.contract";
import type {Shipment} from "../contracts/shipment.contract";
import type {Tariff} from "../contracts/tariff.contract";
import {createMemoryRepositories} from "./memory";
import {createPostgresRepositories} from "./postgres";
import {DuplicateError, type Repositories} from "./types";

// One behavioural contract, two storages. Whatever the services rely on —
// uniqueness, atomic closes, conditional transitions — is pinned here, so the
// memory store used in tests cannot quietly drift from Postgres in production.

const NOW = new Date("2026-11-01T00:00:00.000Z");

const user = (email: string): StoredUser => ({
    userId: randomUUID(), email, name: "Test", role: "CLIENT", passwordHash: "x", createdAt: NOW.toISOString(),
});

const carrier = (): Carrier => ({
    carrierId: randomUUID(), name: "Test Freight", legalName: "Test Freight LLC",
    supportedTransportTypes: ["AIR", "TRUCK"], acceptedCargoCategories: ["GENERAL", "DANGEROUS"],
});

const tariff = (over: Partial<Tariff> = {}): Tariff => ({
    tariffId: randomUUID(), carrierId: randomUUID(), fromRegionId: randomUUID(), toRegionId: randomUUID(),
    transportType: "AIR", pricePerKgCents: 450, pricePerM3Cents: 0, minChargeCents: 15_000, transitDays: 4, ...over,
});

const rfq = (over: Partial<Rfq> = {}): Rfq => ({
    rfqId: randomUUID(), clientId: randomUUID(), fromRegionId: randomUUID(), toRegionId: randomUUID(),
    weightKg: 2000, volumeM3: 20, cargoCategory: "DANGEROUS", status: "OPEN", eligibleCarrierIds: [randomUUID()],
    createdAt: NOW.toISOString(), expiresAt: new Date(NOW.getTime() + 7 * 864e5).toISOString(), ...over,
});

const quote = (rfqId: string, carrierId: string, priceCents: number): RfqQuote => ({
    quoteId: randomUUID(), rfqId, carrierId, transportType: "SEA", priceCents, transitDays: 28,
    validUntil: "2026-11-05T00:00:00.000Z", status: "SUBMITTED", createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
});

const shipment = (over: Partial<Shipment> = {}): Shipment => ({
    shipmentId: randomUUID(), trackingCode: `FM-${randomUUID().slice(0, 8).toUpperCase()}`, source: "INSTANT",
    clientId: randomUUID(), carrierId: randomUUID(), transportType: "AIR", fromRegionId: randomUUID(), toRegionId: randomUUID(),
    weightKg: 100, volumeM3: 0.2, cargoCategory: "GENERAL", priceCents: 45_000, transitDays: 4, status: "CONFIRMED",
    history: [{status: "CONFIRMED", at: NOW.toISOString(), byUserId: randomUUID(), byRole: "CLIENT"}],
    createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(), ...over,
});

const contract = (name: string, open: () => Promise<Repositories>) => {
    describe(`repositories: ${name}`, () => {
        let r: Repositories;

        before(async () => {
            r = await open();
        });

        after(async () => {
            await r.close();
        });

        it("stores a carrier with its lists intact", async () => {
            const stored = carrier();
            await r.carriers.upsert(stored);

            assert.deepEqual((await r.carriers.list()).find((c) => c.carrierId === stored.carrierId), stored);
        });

        it("replaces a carrier saved again under the same id", async () => {
            const stored = carrier();
            await r.carriers.upsert(stored);
            await r.carriers.upsert({...stored, name: "Renamed", supportedTransportTypes: ["SEA"]});

            const matching = (await r.carriers.list()).filter((c) => c.carrierId === stored.carrierId);
            assert.equal(matching.length, 1);
            assert.equal(matching[0].name, "Renamed");
            assert.deepEqual(matching[0].supportedTransportTypes, ["SEA"]);
        });

        it("refuses a second user with the same email", async () => {
            const email = `${randomUUID()}@example.test`;
            await r.users.insert(user(email));

            await assert.rejects(r.users.insert(user(email)), (e) => e instanceof DuplicateError && e.field === "email");
            assert.equal((await r.users.findByEmail(email))?.email, email);
        });

        it("keeps optional user fields absent rather than null", async () => {
            const stored = user(`${randomUUID()}@example.test`);
            await r.users.insert(stored);

            const read = await r.users.findById(stored.userId);
            assert.deepEqual(read, stored);
        });

        it("refuses a second tariff on the same lane", async () => {
            const first = tariff();
            await r.tariffs.insert(first);

            await assert.rejects(
                r.tariffs.insert({...first, tariffId: randomUUID()}),
                (e) => e instanceof DuplicateError && e.field === "lane",
            );
        });

        it("finds every tariff between two region chains in one call", async () => {
            const from = [randomUUID(), randomUUID()];
            const to = [randomUUID(), randomUUID()];
            await r.tariffs.insert(tariff({fromRegionId: from[0], toRegionId: to[1]}));
            await r.tariffs.insert(tariff({fromRegionId: from[1], toRegionId: to[0]}));
            await r.tariffs.insert(tariff({fromRegionId: from[0]}));

            assert.equal((await r.tariffs.listBetween(from, to)).length, 2);
        });

        it("replaces a carrier's quote instead of adding one, keeping its id", async () => {
            const request = rfq();
            await r.rfqs.insert(request);
            const carrier = request.eligibleCarrierIds[0]!;

            const first = await r.rfqs.upsertQuote(quote(request.rfqId, carrier, 300_000));
            const second = await r.rfqs.upsertQuote(quote(request.rfqId, carrier, 280_000));

            assert.equal(second.quoteId, first.quoteId);
            assert.deepEqual((await r.rfqs.quotesOf(request.rfqId)).map((q) => q.priceCents), [280_000]);
        });

        it("accepts an RFQ once, declining the other quotes in the same step", async () => {
            const request = rfq();
            await r.rfqs.insert(request);
            const a = await r.rfqs.upsertQuote(quote(request.rfqId, randomUUID(), 300_000));
            const b = await r.rfqs.upsertQuote(quote(request.rfqId, randomUUID(), 1_900_000));

            const [first, second] = await Promise.all([
                r.rfqs.accept(request.rfqId, a.quoteId, NOW),
                r.rfqs.accept(request.rfqId, b.quoteId, NOW),
            ]);

            assert.equal(Number(first) + Number(second), 1);
            const stored = await r.rfqs.findById(request.rfqId);
            assert.equal(stored?.status, "ACCEPTED");
            const winner = first ? a.quoteId : b.quoteId;
            assert.equal(stored?.acceptedQuoteId, winner);
            assert.deepEqual(
                (await r.rfqs.quotesOf(request.rfqId)).map((q) => q.status).sort(),
                ["ACCEPTED", "DECLINED"],
            );
        });

        it("expires only an OPEN RFQ that is past its deadline", async () => {
            const request = rfq();
            await r.rfqs.insert(request);

            assert.equal(await r.rfqs.expireIfDue(request.rfqId, NOW), false);
            assert.equal(await r.rfqs.expireIfDue(request.rfqId, new Date(Date.parse(request.expiresAt) + 1)), true);
            assert.equal((await r.rfqs.findById(request.rfqId))?.status, "EXPIRED");
            assert.equal(await r.rfqs.cancel(request.rfqId, NOW), false);
        });

        it("lists RFQs by client and by invited carrier", async () => {
            const carrier = randomUUID();
            const client = randomUUID();
            await r.rfqs.insert(rfq({clientId: client}));
            await r.rfqs.insert(rfq({eligibleCarrierIds: [carrier, randomUUID()]}));

            assert.equal((await r.rfqs.list({clientId: client})).length, 1);
            assert.equal((await r.rfqs.list({carrierId: carrier})).length, 1);
        });

        it("refuses a duplicate tracking code and a second booking of one RFQ", async () => {
            const first = shipment({source: "RFQ", rfqId: randomUUID()});
            await r.shipments.insert(first);

            await assert.rejects(
                r.shipments.insert(shipment({trackingCode: first.trackingCode})),
                (e) => e instanceof DuplicateError && e.field === "trackingCode",
            );
            await assert.rejects(
                r.shipments.insert(shipment({source: "RFQ", rfqId: first.rfqId})),
                (e) => e instanceof DuplicateError && e.field === "rfqId",
            );
        });

        it("moves a shipment only from the status it was read in", async () => {
            const stored = shipment();
            await r.shipments.insert(stored);
            const next = {...stored, status: "PICKED_UP" as const, history: [...stored.history, {status: "PICKED_UP" as const, at: NOW.toISOString(), byUserId: randomUUID(), byRole: "MANAGER" as const}]};

            assert.equal(await r.shipments.transition(next, "CONFIRMED"), true);
            assert.equal(await r.shipments.transition({...next, status: "CANCELLED"}, "CONFIRMED"), false);

            const read = await r.shipments.findByTrackingCode(stored.trackingCode);
            assert.equal(read?.status, "PICKED_UP");
            assert.deepEqual(read?.history, next.history);
        });
    });
};

contract("memory", async () => createMemoryRepositories());

// Against a real Postgres only when asked: the test empties every table, so it
// refuses any database whose name does not say it is for tests.
const testUrl = process.env.TEST_DATABASE_URL;

if (testUrl) {
    const dbName = new URL(testUrl).pathname.slice(1);

    if (!dbName.includes("test")) {
        throw new Error(`TEST_DATABASE_URL must point at a database named *test*, got "${dbName}"`);
    }

    contract("postgres", async () => {
        const admin = new pg.Client({connectionString: testUrl});
        await admin.connect();
        await admin.query("DROP TABLE IF EXISTS shipments, rfq_quotes, rfqs, tariffs, users, carriers CASCADE");
        await admin.end();

        const repositories = createPostgresRepositories(testUrl);
        await repositories.init();
        return repositories;
    });
}
