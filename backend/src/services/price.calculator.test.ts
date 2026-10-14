import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {calculatePrice} from "./price.calculator";

const airTariff = {pricePerKgCents: 450, pricePerM3Cents: 0, minChargeCents: 15_000};
const AIR_FACTOR = 167;

describe("calculatePrice", () => {
    it("bills dense freight by its actual weight", () => {
        const result = calculatePrice({tariff: airTariff, weightKg: 1_000, volumeM3: 1, volumetricFactorKgPerM3: AIR_FACTOR});

        assert.equal(result.chargeableWeightKg, 1_000);
        assert.equal(result.basis, "WEIGHT");
        assert.equal(result.totalCents, 450_000);
    });

    it("bills light, bulky freight by volumetric weight", () => {
        const result = calculatePrice({tariff: airTariff, weightKg: 100, volumeM3: 2, volumetricFactorKgPerM3: AIR_FACTOR});

        assert.equal(result.volumetricWeightKg, 334);
        assert.equal(result.chargeableWeightKg, 334);
        assert.equal(result.totalCents, 334 * 450);
    });

    it("never goes below the minimum charge", () => {
        const result = calculatePrice({tariff: airTariff, weightKg: 10, volumeM3: 0.01, volumetricFactorKgPerM3: AIR_FACTOR});

        assert.equal(result.basis, "MIN_CHARGE");
        assert.equal(result.totalCents, 15_000);
    });

    it("uses the per-m3 rate when measure outweighs weight (sea W/M)", () => {
        const seaTariff = {pricePerKgCents: 4, pricePerM3Cents: 9_000, minChargeCents: 60_000};
        const result = calculatePrice({tariff: seaTariff, weightKg: 2_000, volumeM3: 20, volumetricFactorKgPerM3: 1_000});

        assert.equal(result.weightChargeCents, 80_000);
        assert.equal(result.volumeChargeCents, 180_000);
        assert.equal(result.basis, "VOLUME");
        assert.equal(result.totalCents, 180_000);
    });

    it("rounds the final figure up to a whole cent, once", () => {
        const tariff = {pricePerKgCents: 3, pricePerM3Cents: 0, minChargeCents: 0};
        const result = calculatePrice({tariff, weightKg: 10.1, volumeM3: 0.001, volumetricFactorKgPerM3: 1});

        assert.equal(result.totalCents, 31);
    });
});
