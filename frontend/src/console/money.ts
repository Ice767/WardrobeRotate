// The same ceiling the server validates tariffs against
// (backend/src/validators/tariff.validator.ts): it catches dollars typed as cents.
export const MAX_TARIFF_CENTS = 10_000_000;

// A firm price for a whole consignment can be far larger than a per-kg rate
// (backend/src/validators/rfq.validator.ts).
export const MAX_QUOTE_CENTS = 10_000_000_000;

const NOT_AN_AMOUNT = "Enter an amount in dollars, like 5.20";

/**
 * Dollars as a person types them, into the integer cents the API takes.
 * Digits are read as text rather than through parseFloat, so 1.15 becomes 115
 * and never 114.99999.
 */
export const parseDollars = (raw: string, maxCents: number = MAX_TARIFF_CENTS): {cents: number} | {error: string} => {
    const text = raw.trim().replace(",", ".");
    const match = /^(\d+)(?:\.(\d+))?$/.exec(text);

    if (!match) {
        return {error: NOT_AN_AMOUNT};
    }

    const [, whole, fraction = ""] = match;

    if (fraction.length > 2) {
        return {error: "Use at most two decimals"};
    }

    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

    return cents > maxCents ? {error: `That is more than $${grouped(maxCents / 100)}`} : {cents};
};

const grouped = (value: number): string => value.toLocaleString("en-US").replace(/,/g, " ");

/** Cents back into the text a form field starts with when editing. */
export const centsToInput = (cents: number): string => (cents / 100).toFixed(2);
