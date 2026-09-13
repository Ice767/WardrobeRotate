export const TRANSPORT_TYPES = ["TRUCK", "RAIL", "AIR", "SEA", "LTL"] as const;
export type TransportType = (typeof TRANSPORT_TYPES)[number];

export interface TransportTypeSpec {
    transportType: TransportType;
    label: string;
    /** Per-shipment ceilings — search uses them to drop unsuitable transport. */
    maxWeightKg: number;
    maxVolumeM3: number;
    /** How many kilograms a cubic meter "weighs" when computing volumetric weight. */
    volumetricFactorKgPerM3: number;
}

// Physics and industry convention, not data: air counts a cubic meter as 167 kg,
// sea as a tonne. This shifts once a decade, so it lives in code and is not
// editable through the API.
export const TRANSPORT_TYPE_SPECS: Readonly<Record<TransportType, TransportTypeSpec>> =
    Object.freeze({
        TRUCK: {
            transportType: "TRUCK",
            label: "Full truckload",
            maxWeightKg: 20_000,
            maxVolumeM3: 82,
            volumetricFactorKgPerM3: 250,
        },
        RAIL: {
            transportType: "RAIL",
            label: "Rail freight",
            maxWeightKg: 68_000,
            maxVolumeM3: 138,
            volumetricFactorKgPerM3: 200,
        },
        AIR: {
            transportType: "AIR",
            label: "Air freight",
            maxWeightKg: 5_000,
            maxVolumeM3: 30,
            volumetricFactorKgPerM3: 167,
        },
        SEA: {
            transportType: "SEA",
            label: "Sea freight",
            maxWeightKg: 26_000,
            maxVolumeM3: 67,
            volumetricFactorKgPerM3: 1_000,
        },
        LTL: {
            transportType: "LTL",
            label: "Less-than-truckload",
            maxWeightKg: 1_500,
            maxVolumeM3: 8,
            volumetricFactorKgPerM3: 250,
        },
    });
