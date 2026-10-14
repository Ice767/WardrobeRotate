import type {TariffPrices} from "../contracts/tariff.contract";

export interface PriceInput {
    tariff: Pick<TariffPrices, "pricePerKgCents" | "pricePerM3Cents" | "minChargeCents">;
    weightKg: number;
    volumeM3: number;
    volumetricFactorKgPerM3: number;
}

export interface PriceBreakdown {
    actualWeightKg: number;
    volumetricWeightKg: number;
    /** max(actual, volumetric): what the carrier actually bills by weight. */
    chargeableWeightKg: number;
    weightChargeCents: number;
    volumeChargeCents: number;
    minChargeCents: number;
    /** Which of the three components decided the price. */
    basis: "WEIGHT" | "VOLUME" | "MIN_CHARGE";
    totalCents: number;
}

/**
 * Pure: same input, same output, no store, no clock. Everything about pricing
 * that can be unit-tested lives here.
 *
 * Light, bulky freight is billed by the space it takes, not by the scale —
 * hence chargeable weight. The separate per-m3 rate covers modes such as sea,
 * which bill weight-or-measure, whichever is higher.
 */
export const calculatePrice = (input: PriceInput): PriceBreakdown => {
    const volumetricWeightKg = input.volumeM3 * input.volumetricFactorKgPerM3;
    const chargeableWeightKg = Math.max(input.weightKg, volumetricWeightKg);

    const weightChargeCents = chargeableWeightKg * input.tariff.pricePerKgCents;
    const volumeChargeCents = input.volumeM3 * input.tariff.pricePerM3Cents;
    const freightCents = Math.max(weightChargeCents, volumeChargeCents);

    const basis =
        input.tariff.minChargeCents > freightCents
            ? "MIN_CHARGE"
            : volumeChargeCents > weightChargeCents
              ? "VOLUME"
              : "WEIGHT";

    // Rounded once, at the very end, and always up: intermediate rounding
    // compounds, and a quote below the carrier's own tariff is one they would
    // refuse to honour.
    const totalCents = Math.ceil(Math.max(freightCents, input.tariff.minChargeCents));

    return {
        actualWeightKg: input.weightKg,
        volumetricWeightKg,
        chargeableWeightKg,
        weightChargeCents,
        volumeChargeCents,
        minChargeCents: input.tariff.minChargeCents,
        basis,
        totalCents,
    };
};
