import type {StoredUser} from "../contracts/auth.contract";
import type {Carrier} from "../contracts/carrier.contract";
import type {Region} from "../contracts/region.contract";
import type {Rfq, RfqQuote} from "../contracts/rfq.contract";
import type {Tariff} from "../contracts/tariff.contract";

// In-process memory store: data lives until restart. When a real database
// arrives this module is what gets replaced — the services stay untouched.
export const usersById = new Map<string, StoredUser>();
export const usersByEmail = new Map<string, StoredUser>();

export const regionsById = new Map<string, Region>();
export const carriersById = new Map<string, Carrier>();

export const tariffsById = new Map<string, Tariff>();
/** Lane key -> tariffId. Enforces one tariff per lane without scanning. */
export const tariffIdByLane = new Map<string, string>();

export const rfqsById = new Map<string, Rfq>();
export const rfqQuotesById = new Map<string, RfqQuote>();
