import type {Rfq} from "../api/types";

export type RequestState = "open" | "answered" | "closed";

/**
 * Where a quote request stands for one carrier. Expiry is checked against the
 * clock as well as the status, because the server marks a request expired only
 * when it is next touched.
 */
export const requestState = (rfq: Rfq, carrierId: string, now: Date): RequestState => {
    if (rfq.status !== "OPEN" || now.getTime() >= new Date(rfq.expiresAt).getTime()) {
        return "closed";
    }

    return rfq.quotes.some((quote) => quote.carrierId === carrierId) ? "answered" : "open";
};

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** How long a carrier has left to answer, in the two largest units. */
export const expiresIn = (expiresAt: string, now: Date): string => {
    const left = new Date(expiresAt).getTime() - now.getTime();

    if (left <= 0) {
        return "Expired";
    }

    if (left >= DAY_MS) {
        return `Expires in ${Math.floor(left / DAY_MS)} d ${Math.floor((left % DAY_MS) / HOUR_MS)} h`;
    }

    if (left >= HOUR_MS) {
        return `Expires in ${Math.floor(left / HOUR_MS)} h ${Math.floor((left % HOUR_MS) / MINUTE_MS)} min`;
    }

    // Rounded up, so the last seconds still read "1 min" rather than "0 min".
    return `Expires in ${Math.ceil(left / MINUTE_MS)} min`;
};
