import type {ShipmentStatus} from "../api/types";

// The carrier's path, mirroring backend/src/services/shipment.state.ts.
// Cancelling is the client's choice, so it is not a step here.
const STEPS: ShipmentStatus[] = ["CONFIRMED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"];

/** The status a carrier moves a shipment to next, or null when it is final. */
export const nextStatus = (status: ShipmentStatus): ShipmentStatus | null => {
    const index = STEPS.indexOf(status);
    return index >= 0 && index < STEPS.length - 1 ? STEPS[index + 1] : null;
};

/** How far along the track a shipment is, as a whole percent. */
export const progressPercent = (status: ShipmentStatus): number => {
    const index = STEPS.indexOf(status);
    return index < 0 ? 0 : Math.round((index / (STEPS.length - 1)) * 100);
};
