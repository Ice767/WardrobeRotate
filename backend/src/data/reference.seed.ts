import type {CargoCategory} from "../contracts/cargo.contract";
import type {TransportType} from "../contracts/transport.contract";
import type {RegionLevel} from "../contracts/region.contract";
import {stableId} from "../utils/stable-id";
import {carriersById, regionsById} from "./store";

interface RegionSeed {
    slug: string;
    name: string;
    code: string;
    level: RegionLevel;
    parentSlug: string | null;
}

// Three countries as a statement that shipping is international, not as a focus
// on any one market: a tariff has to be able to link Tel Aviv to Chicago, not
// only city to city inside a single country.
//
// Branch depth is deliberately uneven. Israel has no intermediate DISTRICT —
// the country is small, so its districts sit right under it; Moscow hangs off a
// federal district, skipping the oblast. The hierarchy is not required to be
// level, and tariff lookup walking up parentId has to survive that.
//
// slug is the key regionId is derived from, so it is globally unique and always
// country-prefixed: SFO is the IATA code for San Francisco, but the same three
// letters abbreviate Russia's Siberian Federal District.
const US_REGION_SEEDS: RegionSeed[] = [
    {slug: "us", name: "United States", code: "US", level: "COUNTRY", parentSlug: null},

    {slug: "us-northeast", name: "Northeast", code: "US-NE", level: "DISTRICT", parentSlug: "us"},
    {slug: "us-ny", name: "New York", code: "US-NY", level: "REGION", parentSlug: "us-northeast"},
    {slug: "us-nyc", name: "New York City", code: "NYC", level: "CITY", parentSlug: "us-ny"},

    {slug: "us-midwest", name: "Midwest", code: "US-MW", level: "DISTRICT", parentSlug: "us"},
    {slug: "us-il", name: "Illinois", code: "US-IL", level: "REGION", parentSlug: "us-midwest"},
    {slug: "us-chi", name: "Chicago", code: "CHI", level: "CITY", parentSlug: "us-il"},

    {slug: "us-south", name: "South", code: "US-SO", level: "DISTRICT", parentSlug: "us"},
    {slug: "us-tx", name: "Texas", code: "US-TX", level: "REGION", parentSlug: "us-south"},
    {slug: "us-hou", name: "Houston", code: "HOU", level: "CITY", parentSlug: "us-tx"},
    {slug: "us-fl", name: "Florida", code: "US-FL", level: "REGION", parentSlug: "us-south"},
    {slug: "us-mia", name: "Miami", code: "MIA", level: "CITY", parentSlug: "us-fl"},

    {slug: "us-west", name: "West", code: "US-WE", level: "DISTRICT", parentSlug: "us"},
    {slug: "us-ca", name: "California", code: "US-CA", level: "REGION", parentSlug: "us-west"},
    {slug: "us-lax", name: "Los Angeles", code: "LAX", level: "CITY", parentSlug: "us-ca"},
    {slug: "us-sfo", name: "San Francisco", code: "SFO", level: "CITY", parentSlug: "us-ca"},
];

const IL_REGION_SEEDS: RegionSeed[] = [
    {slug: "il", name: "Israel", code: "IL", level: "COUNTRY", parentSlug: null},

    {slug: "il-ta", name: "Tel Aviv District", code: "IL-TA", level: "REGION", parentSlug: "il"},
    {slug: "il-tlv", name: "Tel Aviv", code: "TLV", level: "CITY", parentSlug: "il-ta"},

    {slug: "il-jm", name: "Jerusalem District", code: "IL-JM", level: "REGION", parentSlug: "il"},
    {slug: "il-jrs", name: "Jerusalem", code: "JRS", level: "CITY", parentSlug: "il-jm"},

    {slug: "il-ha", name: "Haifa District", code: "IL-HA", level: "REGION", parentSlug: "il"},
    {slug: "il-hfa", name: "Haifa", code: "HFA", level: "CITY", parentSlug: "il-ha"},

    {slug: "il-d", name: "Southern District", code: "IL-D", level: "REGION", parentSlug: "il"},
    {slug: "il-asd", name: "Ashdod", code: "ASD", level: "CITY", parentSlug: "il-d"},
    {slug: "il-eth", name: "Eilat", code: "ETH", level: "CITY", parentSlug: "il-d"},
];

const RU_REGION_SEEDS: RegionSeed[] = [
    {slug: "ru", name: "Russia", code: "RU", level: "COUNTRY", parentSlug: null},

    {slug: "ru-cfo", name: "Central Federal District", code: "RU-CFO", level: "DISTRICT", parentSlug: "ru"},
    {slug: "ru-mow", name: "Moscow", code: "MOW", level: "CITY", parentSlug: "ru-cfo"},
    {slug: "ru-mos", name: "Moscow Region", code: "RU-MOS", level: "REGION", parentSlug: "ru-cfo"},
    {slug: "ru-pod", name: "Podolsk", code: "POD", level: "CITY", parentSlug: "ru-mos"},

    {slug: "ru-szfo", name: "Northwestern Federal District", code: "RU-SZFO", level: "DISTRICT", parentSlug: "ru"},
    {slug: "ru-led", name: "Saint Petersburg", code: "LED", level: "CITY", parentSlug: "ru-szfo"},
    {slug: "ru-len", name: "Leningrad Region", code: "RU-LEN", level: "REGION", parentSlug: "ru-szfo"},

    {slug: "ru-pfo", name: "Volga Federal District", code: "RU-PFO", level: "DISTRICT", parentSlug: "ru"},
    {slug: "ru-ta", name: "Republic of Tatarstan", code: "RU-TA", level: "REGION", parentSlug: "ru-pfo"},
    {slug: "ru-kzn", name: "Kazan", code: "KZN", level: "CITY", parentSlug: "ru-ta"},
    {slug: "ru-sam", name: "Samara Region", code: "RU-SAM", level: "REGION", parentSlug: "ru-pfo"},
    {slug: "ru-kuf", name: "Samara", code: "KUF", level: "CITY", parentSlug: "ru-sam"},

    {slug: "ru-ufo", name: "Ural Federal District", code: "RU-UFO", level: "DISTRICT", parentSlug: "ru"},
    {slug: "ru-sve", name: "Sverdlovsk Region", code: "RU-SVE", level: "REGION", parentSlug: "ru-ufo"},
    {slug: "ru-svx", name: "Yekaterinburg", code: "SVX", level: "CITY", parentSlug: "ru-sve"},

    {slug: "ru-sfo", name: "Siberian Federal District", code: "RU-SFO", level: "DISTRICT", parentSlug: "ru"},
    {slug: "ru-nvs", name: "Novosibirsk Region", code: "RU-NVS", level: "REGION", parentSlug: "ru-sfo"},
    {slug: "ru-ovb", name: "Novosibirsk", code: "OVB", level: "CITY", parentSlug: "ru-nvs"},
];

const REGION_SEEDS: RegionSeed[] = [
    ...US_REGION_SEEDS,
    ...IL_REGION_SEEDS,
    ...RU_REGION_SEEDS,
];

interface CarrierSeed {
    slug: string;
    name: string;
    legalName: string;
    supportedTransportTypes: TransportType[];
    acceptedCargoCategories: CargoCategory[];
}

const CARRIER_SEEDS: CarrierSeed[] = [
    {
        slug: "translogistic",
        name: "TransLogistic",
        legalName: "TransLogistic LLC",
        supportedTransportTypes: ["TRUCK", "LTL"],
        acceptedCargoCategories: ["GENERAL", "OVERSIZED"],
    },
    {
        slug: "railcargo",
        name: "RailCargo",
        legalName: "RailCargo JSC",
        supportedTransportTypes: ["RAIL", "TRUCK"],
        acceptedCargoCategories: ["GENERAL", "DANGEROUS", "OVERSIZED"],
    },
    {
        slug: "aerofreight",
        name: "AeroFreight",
        legalName: "AeroFreight LLC",
        supportedTransportTypes: ["AIR", "LTL"],
        acceptedCargoCategories: ["GENERAL", "DANGEROUS", "TEMPERATURE_CONTROLLED", "VALUABLE", "LIVE_ANIMALS"],
    },
    {
        slug: "seatransline",
        name: "SeaTransLine",
        legalName: "SeaTransLine LLC",
        supportedTransportTypes: ["SEA", "TRUCK"],
        acceptedCargoCategories: ["GENERAL", "DANGEROUS", "TEMPERATURE_CONTROLLED", "OVERSIZED"],
    },
];

export const regionIdBySlug = (slug: string): string => stableId(`region:${slug}`);
export const carrierIdBySlug = (slug: string): string => stableId(`carrier:${slug}`);

// The region list is maintained by hand and both mistakes it invites are silent:
// a duplicate slug quietly overwrites a region in the Map, and a typo in
// parentSlug leaves an orphan whose path upward breaks off. The server refuses
// to start on inconsistent seeds.
const assertRegionSeedsAreConsistent = (): void => {
    const slugs = new Set<string>();

    for (const seed of REGION_SEEDS) {
        if (slugs.has(seed.slug)) {
            throw new Error(`Duplicate region seed slug: ${seed.slug}`);
        }

        slugs.add(seed.slug);
    }

    for (const seed of REGION_SEEDS) {
        if (seed.parentSlug !== null && !slugs.has(seed.parentSlug)) {
            throw new Error(
                `Region seed "${seed.slug}" points at unknown parent "${seed.parentSlug}"`,
            );
        }
    }
};

export const seedReferenceData = (): void => {
    assertRegionSeedsAreConsistent();

    for (const seed of REGION_SEEDS) {
        const regionId = regionIdBySlug(seed.slug);

        regionsById.set(regionId, {
            regionId,
            name: seed.name,
            code: seed.code,
            level: seed.level,
            // The parent link is computed from the parent's slug rather than
            // looked up in the Map, so the order of entries does not matter.
            parentId: seed.parentSlug === null ? null : regionIdBySlug(seed.parentSlug),
        });
    }

    for (const seed of CARRIER_SEEDS) {
        const carrierId = carrierIdBySlug(seed.slug);

        carriersById.set(carrierId, {
            carrierId,
            name: seed.name,
            legalName: seed.legalName,
            supportedTransportTypes: seed.supportedTransportTypes,
            acceptedCargoCategories: seed.acceptedCargoCategories,
        });
    }
};
