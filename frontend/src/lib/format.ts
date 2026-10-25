import type {Quote, Region} from "../api/types";

const usd = new Intl.NumberFormat("en-US", {style: "currency", currency: "USD"});
const kg = new Intl.NumberFormat("en-US", {maximumFractionDigits: 0});

/** Money crosses the API as integer cents; it becomes dollars only on screen. */
export const formatCents = (cents: number): string => usd.format(cents / 100);

export const formatRange = (range: {min: number; max: number}): string =>
    `${formatCents(range.min)} – ${formatCents(range.max)}`;

export const formatDays = (days: number): string => (days === 1 ? "1 day" : `${days} days`);

/** How the figure was reached, in the client's words rather than the formula's. */
export const describeBasis = (quote: Quote, volumeM3: number): string | null => {
    const breakdown = quote.breakdown;

    if (!breakdown) {
        return null;
    }

    switch (breakdown.basis) {
        case "VOLUME":
            return `Billed by volume: ${volumeM3} m³`;
        case "MIN_CHARGE":
            return "Carrier's minimum charge applies";
        case "WEIGHT":
            return `Billed by weight: ${kg.format(breakdown.chargeableWeightKg)} kg chargeable`;
    }
};

/** The single cheapest and the single fastest offer, among those with a price. */
export const pickHighlights = (quotes: Quote[]): {cheapest?: Quote; fastest?: Quote} => {
    const priced = quotes.filter((q) => q.priceCents !== undefined);

    if (priced.length < 2) {
        return {};
    }

    const cheapest = priced.reduce((a, b) => (b.priceCents! < a.priceCents! ? b : a));
    const fastest = priced.reduce((a, b) => (b.transitDays < a.transitDays ? b : a));

    return {cheapest, fastest: fastest.transitDays < cheapest.transitDays ? fastest : undefined};
};

/** Each region's country, found by walking up parentId: used to group pickers. */
export const countryOf = (region: Region, byId: Map<string, Region>): Region => {
    let current = region;

    while (current.parentId !== null) {
        const parent = byId.get(current.parentId);
        if (!parent) break;
        current = parent;
    }

    return current;
};
