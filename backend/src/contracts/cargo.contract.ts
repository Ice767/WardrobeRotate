// Modelled on IATA special handling codes (DGR, PER, VAL, AVI, HEA/BIG): what
// is being carried decides how much the platform may promise about price.
export const CARGO_CATEGORIES = [
    "GENERAL",
    "DANGEROUS",
    "TEMPERATURE_CONTROLLED",
    "OVERSIZED",
    "VALUABLE",
    "LIVE_ANIMALS",
] as const;
export type CargoCategory = (typeof CARGO_CATEGORIES)[number];

/**
 * INSTANT     — an exact, bookable price from the tariff.
 * INDICATIVE  — a range only; the carrier confirms the final figure.
 * ON_REQUEST  — no price at all; the client must ask the carrier directly.
 */
export const PRICING_MODES = ["INSTANT", "INDICATIVE", "ON_REQUEST"] as const;
export type PricingMode = (typeof PRICING_MODES)[number];

export interface CargoCategorySpec {
    category: CargoCategory;
    label: string;
    pricingMode: PricingMode;
    /**
     * INDICATIVE only: the base tariff price is multiplied by these to form the
     * range shown to the client. They are the platform's own working
     * assumptions for special handling, not published industry figures.
     */
    indicativeMultiplier?: {min: number; max: number};
}

// VALUABLE and LIVE_ANIMALS get no price at all. A tariff-derived number for an
// armoured transfer or a horse would be wrong in a way that misleads, and for
// valuables even a quoted figure hints at what is being shipped.
export const CARGO_CATEGORY_SPECS: Readonly<Record<CargoCategory, CargoCategorySpec>> =
    Object.freeze({
        GENERAL: {
            category: "GENERAL",
            label: "General cargo",
            pricingMode: "INSTANT",
        },
        DANGEROUS: {
            category: "DANGEROUS",
            label: "Dangerous goods",
            pricingMode: "INDICATIVE",
            indicativeMultiplier: {min: 1.25, max: 1.75},
        },
        TEMPERATURE_CONTROLLED: {
            category: "TEMPERATURE_CONTROLLED",
            label: "Temperature-controlled",
            pricingMode: "INDICATIVE",
            indicativeMultiplier: {min: 1.3, max: 2},
        },
        OVERSIZED: {
            category: "OVERSIZED",
            label: "Oversized / heavy lift",
            pricingMode: "INDICATIVE",
            indicativeMultiplier: {min: 1.5, max: 3},
        },
        VALUABLE: {
            category: "VALUABLE",
            label: "Valuables",
            pricingMode: "ON_REQUEST",
        },
        LIVE_ANIMALS: {
            category: "LIVE_ANIMALS",
            label: "Live animals",
            pricingMode: "ON_REQUEST",
        },
    });
