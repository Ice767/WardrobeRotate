export const REGION_LEVELS = ["COUNTRY", "DISTRICT", "REGION", "CITY"] as const;
export type RegionLevel = (typeof REGION_LEVELS)[number];

export interface Region {
    regionId: string;
    name: string;
    /** Short human-readable code: US, US-CA, TLV. May change over time. */
    code: string;
    level: RegionLevel;
    /** null only on a country — the root of the hierarchy. */
    parentId: string | null;
}

export interface RegionWithPath extends Region {
    /** Chain from the country down to the region itself, which is the last item. */
    path: Region[];
}
