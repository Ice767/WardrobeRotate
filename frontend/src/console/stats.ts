import type {Rfq, Shipment, Tariff} from "../api/types";
import {requestState} from "./requests";

export interface ConsoleStats {
    activeTariffs: number;
    requestsToAnswer: number;
    inProgress: number;
    bookedThisMonthCents: number;
    /** Seven 7-day windows, oldest first; the last one ends now. */
    weeklyBookingsCents: number[];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEEKS = 7;

/** A cancelled booking brought no money, so it is left out of every sum. */
const counts = (shipment: Shipment) => shipment.status !== "CANCELLED";

export const consoleStats = ({
    carrierId,
    tariffs,
    rfqs,
    shipments,
    now,
}: {
    carrierId: string;
    tariffs: Tariff[];
    rfqs: Rfq[];
    shipments: Shipment[];
    now: Date;
}): ConsoleStats => {
    const booked = shipments.filter(counts);
    const nowMs = now.getTime();

    // Calendar month in UTC, the same clock the server stamps createdAt with.
    const sameMonth = (iso: string) => {
        const at = new Date(iso);
        return at.getUTCFullYear() === now.getUTCFullYear() && at.getUTCMonth() === now.getUTCMonth();
    };

    const weekly = Array.from({length: WEEKS}, () => 0);
    for (const shipment of booked) {
        const age = nowMs - new Date(shipment.createdAt).getTime();
        const weeksAgo = Math.floor(age / WEEK_MS);
        if (age >= 0 && weeksAgo < WEEKS) {
            weekly[WEEKS - 1 - weeksAgo] += shipment.priceCents;
        }
    }

    return {
        activeTariffs: tariffs.length,
        requestsToAnswer: rfqs.filter((rfq) => requestState(rfq, carrierId, now) === "open").length,
        inProgress: shipments.filter((s) => s.status !== "DELIVERED" && s.status !== "CANCELLED").length,
        bookedThisMonthCents: booked.filter((s) => sameMonth(s.createdAt)).reduce((sum, s) => sum + s.priceCents, 0),
        weeklyBookingsCents: weekly,
    };
};
