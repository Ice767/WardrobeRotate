import type {UserRole} from "./auth.contract";
import type {CargoCategory} from "./cargo.contract";
import type {TransportType} from "./transport.contract";

// No DRAFT: a shipment is born with its price already fixed - by the calculator
// or by an accepted RFQ quote - so there is nothing left to draft. A DRAFT state
// earns its place once payment arrives, as "booked but not yet paid".
export const SHIPMENT_STATUSES = [
    "CONFIRMED",
    "PICKED_UP",
    "IN_TRANSIT",
    "DELIVERED",
    "CANCELLED",
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const SHIPMENT_SOURCES = ["INSTANT", "RFQ"] as const;
export type ShipmentSource = (typeof SHIPMENT_SOURCES)[number];

export interface ShipmentEvent {
    status: ShipmentStatus;
    at: string;
    byUserId: string;
    byRole: UserRole;
    note?: string;
}

export interface Shipment {
    shipmentId: string;
    /** Short code a client can read over the phone or type into public tracking. */
    trackingCode: string;
    source: ShipmentSource;
    rfqId?: string;
    tariffId?: string;
    clientId: string;
    carrierId: string;
    transportType: TransportType;
    fromRegionId: string;
    toRegionId: string;
    weightKg: number;
    volumeM3: number;
    cargoCategory: CargoCategory;
    description?: string;
    declaredValueCents?: number;
    /**
     * Frozen at booking. A carrier raising its tariff tomorrow must not change
     * what was agreed today.
     */
    priceCents: number;
    transitDays: number;
    status: ShipmentStatus;
    /** Every status change, oldest first: the tracking timeline. */
    history: ShipmentEvent[];
    createdAt: string;
    updatedAt: string;
}

export interface ShipmentActor {
    userId: string;
    role: UserRole;
    carrierId?: string;
}

export interface BookInstantInput {
    source: "INSTANT";
    carrierId: string;
    transportType: TransportType;
    fromRegionId: string;
    toRegionId: string;
    weightKg: number;
    volumeM3: number;
    cargoCategory: CargoCategory;
    description?: string;
}

export interface BookFromRfqInput {
    source: "RFQ";
    rfqId: string;
}

export type BookShipmentInput = BookInstantInput | BookFromRfqInput;

/** What anyone holding the tracking code may see: no price, no client, no contents. */
export interface PublicTracking {
    trackingCode: string;
    status: ShipmentStatus;
    transportType: TransportType;
    fromRegionId: string;
    toRegionId: string;
    history: Array<Pick<ShipmentEvent, "status" | "at">>;
}
