import type {Region, RegionLevel, RegionWithPath} from "../contracts/region.contract";
import {regionsById} from "../data/store";
import {NotFoundError} from "../errors/app.error";

export interface ListRegionsFilter {
    parentId?: string;
    level?: RegionLevel;
}

export const listRegions = (filter: ListRegionsFilter = {}): Region[] => {
    const regions = [...regionsById.values()].filter((region) => {
        if (filter.parentId !== undefined && region.parentId !== filter.parentId) {
            return false;
        }

        if (filter.level !== undefined && region.level !== filter.level) {
            return false;
        }

        return true;
    });

    return regions.sort((left, right) => left.name.localeCompare(right.name));
};

export const getRegionById = (regionId: string): Region => {
    const region = regionsById.get(regionId);

    if (!region) {
        throw new NotFoundError("Region not found");
    }

    return region;
};

/**
 * The parentId chain, reversed to run from the country down to the region
 * itself: [Israel, Tel Aviv District, Tel Aviv]. Tariff lookup walks it from
 * specific to general — Tel Aviv -> Chicago first, then Tel Aviv District ->
 * Chicago if no tariff was set that narrowly.
 */
export const getRegionPath = (regionId: string): Region[] => {
    const path: Region[] = [];
    let current: Region | undefined = getRegionById(regionId);

    while (current) {
        path.unshift(current);
        current = current.parentId === null ? undefined : regionsById.get(current.parentId);
    }

    return path;
};

export const getRegionWithPath = (regionId: string): RegionWithPath => {
    return {
        ...getRegionById(regionId),
        path: getRegionPath(regionId),
    };
};
