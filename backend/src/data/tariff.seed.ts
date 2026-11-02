import type {TransportType} from "../contracts/transport.contract";
import {repos} from "../repositories";
import {insertTariff} from "../services/tariff.service";
import {stableId} from "../utils/stable-id";
import {carrierIdBySlug, regionIdBySlug} from "./reference.seed";

interface TariffSeed {
    carrier: string;
    from: string;
    to: string;
    transportType: TransportType;
    pricePerKgCents: number;
    pricePerM3Cents: number;
    minChargeCents: number;
    transitDays: number;
}

// Two AeroFreight lanes cover the same trip at different granularity on
// purpose: Tel Aviv -> Chicago is priced city to city, while Israel -> United
// States is a country-wide fallback. The calculator has to prefer the narrow one.
const TARIFF_SEEDS: TariffSeed[] = [
    {carrier: "aerofreight", from: "il-tlv", to: "us-chi", transportType: "AIR",
        pricePerKgCents: 450, pricePerM3Cents: 0, minChargeCents: 15_000, transitDays: 4},
    {carrier: "aerofreight", from: "il", to: "us", transportType: "AIR",
        pricePerKgCents: 520, pricePerM3Cents: 0, minChargeCents: 18_000, transitDays: 6},
    {carrier: "seatransline", from: "il-asd", to: "us-hou", transportType: "SEA",
        pricePerKgCents: 4, pricePerM3Cents: 9_000, minChargeCents: 60_000, transitDays: 28},
    {carrier: "translogistic", from: "us-ca", to: "us-tx", transportType: "TRUCK",
        pricePerKgCents: 22, pricePerM3Cents: 0, minChargeCents: 25_000, transitDays: 3},
    {carrier: "translogistic", from: "us-nyc", to: "us-chi", transportType: "LTL",
        pricePerKgCents: 40, pricePerM3Cents: 0, minChargeCents: 9_000, transitDays: 4},
    {carrier: "railcargo", from: "ru-cfo", to: "ru-sfo", transportType: "RAIL",
        pricePerKgCents: 8, pricePerM3Cents: 0, minChargeCents: 40_000, transitDays: 7},
];

// Goes through insertTariff, the same integrity check the API uses, so a seed
// naming a carrier that does not run that transport type aborts startup.
// A lane that already exists is left alone: with a database, every restart
// would otherwise hit the unique rule, and a manager may have repriced it.
export const seedTariffs = async (): Promise<void> => {
    for (const seed of TARIFF_SEEDS) {
        const lane = {
            carrierId: carrierIdBySlug(seed.carrier),
            fromRegionId: regionIdBySlug(seed.from),
            toRegionId: regionIdBySlug(seed.to),
            transportType: seed.transportType,
        };

        if (await repos().tariffs.findByLane(lane)) {
            continue;
        }

        await insertTariff({
            tariffId: stableId(`tariff:${seed.carrier}:${seed.from}:${seed.to}:${seed.transportType}`),
            carrierId: carrierIdBySlug(seed.carrier),
            fromRegionId: regionIdBySlug(seed.from),
            toRegionId: regionIdBySlug(seed.to),
            transportType: seed.transportType,
            pricePerKgCents: seed.pricePerKgCents,
            pricePerM3Cents: seed.pricePerM3Cents,
            minChargeCents: seed.minChargeCents,
            transitDays: seed.transitDays,
        });
    }
};
