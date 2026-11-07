// The same limits the backend validates against (backend/src/validators/quote.validator.ts).
// Checking them here turns "Request body validation failed" into a sentence.
export const MAX_WEIGHT_KG = 68_000;
export const MAX_VOLUME_M3 = 138;

const grouped = (value: number): string => value.toLocaleString("en-US").replace(/,/g, " ");

/** A number typed by a person: spaces around are ignored, a comma counts as a decimal point. */
export const parseQuantity = (raw: string): number => {
    const trimmed = raw.trim().replace(",", ".");
    return trimmed === "" ? Number.NaN : Number(trimmed);
};

export const weightProblem = (raw: string): string | null => {
    const kg = parseQuantity(raw);

    if (!(kg > 0)) {
        return "Enter the weight in kilograms";
    }

    return kg > MAX_WEIGHT_KG ? `The heaviest single shipment any carrier takes is ${grouped(MAX_WEIGHT_KG)} kg. Split the load.` : null;
};

export const volumeProblem = (raw: string): string | null => {
    const m3 = parseQuantity(raw);

    if (!(m3 > 0)) {
        return "Enter the volume in cubic meters";
    }

    return m3 > MAX_VOLUME_M3 ? `The largest single shipment any carrier takes is ${grouped(MAX_VOLUME_M3)} m³. Split the load.` : null;
};
