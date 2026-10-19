import type {UserRole} from "../contracts/auth.contract";
import type {ShipmentStatus} from "../contracts/shipment.contract";

interface Transition {
    to: ShipmentStatus;
    by: readonly UserRole[];
}

/**
 * The whole lifecycle as data. Physical progress is reported by the carrier,
 * who holds the cargo; admins can do anything a carrier can, for support.
 * Cancelling is possible only before pickup: once the goods are with the
 * carrier, "cancel" would mean a return shipment, not a status change.
 */
export const SHIPMENT_TRANSITIONS: Readonly<Record<ShipmentStatus, readonly Transition[]>> =
    Object.freeze({
        CONFIRMED: [
            {to: "PICKED_UP", by: ["MANAGER", "ADMIN"]},
            {to: "CANCELLED", by: ["CLIENT", "MANAGER", "ADMIN"]},
        ],
        PICKED_UP: [{to: "IN_TRANSIT", by: ["MANAGER", "ADMIN"]}],
        IN_TRANSIT: [{to: "DELIVERED", by: ["MANAGER", "ADMIN"]}],
        DELIVERED: [],
        CANCELLED: [],
    });

export type TransitionCheck =
    | {allowed: true}
    | {allowed: false; reason: "INVALID_TRANSITION" | "ROLE_NOT_ALLOWED"};

/** Pure: whether `role` may move a shipment from `from` to `to`. */
export const checkTransition = (
    from: ShipmentStatus,
    to: ShipmentStatus,
    role: UserRole,
): TransitionCheck => {
    const transition = SHIPMENT_TRANSITIONS[from].find((t) => t.to === to);

    if (!transition) {
        return {allowed: false, reason: "INVALID_TRANSITION"};
    }

    if (!transition.by.includes(role)) {
        return {allowed: false, reason: "ROLE_NOT_ALLOWED"};
    }

    return {allowed: true};
};
