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
