import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {beforeEach, describe, it} from "node:test";

import type {Carrier} from "../contracts/carrier.contract";
import {carrierIdBySlug, seedReferenceData} from "../data/reference.seed";
import {carriersById} from "../data/store";
import {repos, useRepositories} from "../repositories";
import {createMemoryRepositories} from "../repositories/memory";
import {addCarrier, carrierExists, listCarriers, loadCarriers, saveSeededCarriers} from "./carrier.service";

const newCarrier = (): Carrier => ({
    carrierId: randomUUID(), name: "Northwind Cargo", legalName: "Northwind Cargo Ltd",
    supportedTransportTypes: ["TRUCK"], acceptedCargoCategories: ["GENERAL"],
});

describe("carrier storage", () => {
    beforeEach(() => {
        useRepositories(createMemoryRepositories());
        carriersById.clear();
        seedReferenceData();
    });

    it("writes the carriers defined in code into storage", async () => {
        await saveSeededCarriers();

        const stored = await repos().carriers.list();
        assert.equal(stored.length, carriersById.size);
        assert.ok(stored.some((c) => c.carrierId === carrierIdBySlug("aerofreight")));
    });

    it("makes an added carrier visible at once and keeps it in storage", async () => {
        const carrier = newCarrier();
        await addCarrier(carrier);

        assert.equal(carrierExists(carrier.carrierId), true);
        assert.ok(listCarriers().some((c) => c.carrierId === carrier.carrierId));
        assert.deepEqual((await repos().carriers.list()).find((c) => c.carrierId === carrier.carrierId), carrier);
    });

    it("brings an added carrier back after a restart", async () => {
        const carrier = newCarrier();
        await saveSeededCarriers();
        await addCarrier(carrier);

        // A restart: memory is rebuilt from the code seeds, then from storage.
        carriersById.clear();
        seedReferenceData();
        assert.equal(carrierExists(carrier.carrierId), false);

        await loadCarriers();
        assert.equal(carrierExists(carrier.carrierId), true);
        assert.equal(carrierExists(carrierIdBySlug("aerofreight")), true);
    });
});
