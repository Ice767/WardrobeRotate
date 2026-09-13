import type {StoredUser} from "../contracts/auth.contract";
import type {Carrier} from "../contracts/carrier.contract";
import type {Region} from "../contracts/region.contract";

// In-process memory store: data lives until restart. When a real database
// arrives this module is what gets replaced — the services stay untouched.
export const usersById = new Map<string, StoredUser>();
export const usersByEmail = new Map<string, StoredUser>();

export const regionsById = new Map<string, Region>();
export const carriersById = new Map<string, Carrier>();
