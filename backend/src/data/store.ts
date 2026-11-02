import type {Carrier} from "../contracts/carrier.contract";
import type {Region} from "../contracts/region.contract";

// Reference data defined in code and rebuilt on every boot from the seeds:
// regions and carriers, like transport types, change with a deploy rather than
// through the API. Everything users create lives behind ../repositories.
export const regionsById = new Map<string, Region>();
export const carriersById = new Map<string, Carrier>();
