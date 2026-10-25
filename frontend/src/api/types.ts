// Mirrors of the backend contracts the UI reads. Kept by hand: the backend is a
// separate package, and these are the few shapes the screens actually touch.

export type TransportType = "TRUCK" | "RAIL" | "AIR" | "SEA" | "LTL";
export type PricingMode = "INSTANT" | "INDICATIVE" | "ON_REQUEST";
export type CargoCategory =
    | "GENERAL"
    | "DANGEROUS"
    | "TEMPERATURE_CONTROLLED"
    | "OVERSIZED"
    | "VALUABLE"
    | "LIVE_ANIMALS";
export type UserRole = "CLIENT" | "MANAGER" | "ADMIN";

export interface Envelope<T> {
    success: boolean;
    meta: {correlationId: string; status: string; errorMessage?: string};
    data: T;
}

export interface Region {
    regionId: string;
    name: string;
    code: string;
    level: "COUNTRY" | "DISTRICT" | "REGION" | "CITY";
    parentId: string | null;
}

export interface Carrier {
    carrierId: string;
    name: string;
}

export interface CargoCategorySpec {
    category: CargoCategory;
    label: string;
    pricingMode: PricingMode;
}

export interface QuoteRequest {
    fromRegionId: string;
    toRegionId: string;
    weightKg: number;
    volumeM3: number;
    cargoCategory: CargoCategory;
}

export interface Quote {
    carrierId: string;
    carrierName: string;
    transportType: TransportType;
    transitDays: number;
    pricingMode: PricingMode;
    matchedFromRegionId: string;
    matchedToRegionId: string;
    priceCents?: number;
    priceRangeCents?: {min: number; max: number};
    breakdown?: {
        chargeableWeightKg: number;
        basis: "WEIGHT" | "VOLUME" | "MIN_CHARGE";
    };
}

export interface PublicUser {
    userId: string;
    email: string;
    name: string;
    role: UserRole;
    carrierId?: string;
}

export type ShipmentStatus = "CONFIRMED" | "PICKED_UP" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED";

export interface Shipment {
    shipmentId: string;
    trackingCode: string;
    source: "INSTANT" | "RFQ";
    rfqId?: string;
    carrierId: string;
    transportType: TransportType;
    fromRegionId: string;
    toRegionId: string;
    priceCents: number;
    transitDays: number;
    status: ShipmentStatus;
    createdAt: string;
}

export interface Tracking {
    trackingCode: string;
    status: ShipmentStatus;
    transportType: TransportType;
    fromRegionId: string;
    toRegionId: string;
    history: Array<{status: ShipmentStatus; at: string}>;
}

export type RfqStatus = "OPEN" | "ACCEPTED" | "CANCELLED" | "EXPIRED";

export interface RfqQuote {
    quoteId: string;
    carrierId: string;
    transportType: TransportType;
    priceCents: number;
    transitDays: number;
    validUntil: string;
    comment?: string;
    status: "SUBMITTED" | "ACCEPTED" | "DECLINED";
}

export interface Rfq {
    rfqId: string;
    fromRegionId: string;
    toRegionId: string;
    weightKg: number;
    volumeM3: number;
    cargoCategory: CargoCategory;
    status: RfqStatus;
    eligibleCarrierIds: string[];
    acceptedQuoteId?: string;
    createdAt: string;
    expiresAt: string;
    quotes: RfqQuote[];
}
