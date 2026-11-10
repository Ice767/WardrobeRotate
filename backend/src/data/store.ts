import type {Carrier} from "../contracts/carrier.contract";
import type {Region} from "../contracts/region.contract";

// Kept in memory because every price search reads them. Regions are reference
// data defined in code and change with a deploy. Carriers start from the seeds
// in code and are then topped up from the carriers table, so this map is a
// cache of that table (see services/carrier.service.ts).
export const regionsById = new Map<string, Region>();
export const carriersById = new Map<string, Carrier>();
