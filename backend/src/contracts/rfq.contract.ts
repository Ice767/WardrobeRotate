import type {UserRole} from "./auth.contract";
import type {CargoCategory} from "./cargo.contract";
import type {TransportType} from "./transport.contract";

export const RFQ_STATUSES = ["OPEN", "ACCEPTED", "CANCELLED", "EXPIRED"] as const;
export type RfqStatus = (typeof RFQ_STATUSES)[number];

export const RFQ_QUOTE_STATUSES = ["SUBMITTED", "ACCEPTED", "DECLINED"] as const;
export type RfqQuoteStatus = (typeof RFQ_QUOTE_STATUSES)[number];

/** A client's request for carriers to name their own price. */
export interface Rfq {
    rfqId: string;
    clientId: string;
    fromRegionId: string;
    toRegionId: string;
    weightKg: number;
    volumeM3: number;
    cargoCategory: CargoCategory;
    transportType?: TransportType;
    /** ISO date the cargo can be collected from. */
    readyDate?: string;
    /** Sensitive for VALUABLE: hidden from carriers until their quote is accepted. */
    description?: string;
    /** Sensitive for VALUABLE, same rule as description. */
    declaredValueCents?: number;
    status: RfqStatus;
    /**
     * Carriers invited at creation time. A snapshot, not a live query: a carrier
     * who later drops the lane still sees, and can still answer, what it was sent.
     */
    eligibleCarrierIds: string[];
    acceptedQuoteId?: string;
    createdAt: string;
    expiresAt: string;
}

/** One carrier's answer to an RFQ. At most one per carrier per RFQ. */
export interface RfqQuote {
    quoteId: string;
    rfqId: string;
    carrierId: string;
    priceCents: number;
    transitDays: number;
    /** The carrier's own deadline for this price; accepting after it is refused. */
    validUntil: string;
    comment?: string;
    status: RfqQuoteStatus;
    createdAt: string;
    updatedAt: string;
}

export interface RfqActor {
    userId: string;
    role: UserRole;
    carrierId?: string;
}

export type CreateRfqInput = Pick<
    Rfq,
    | "fromRegionId"
    | "toRegionId"
    | "weightKg"
    | "volumeM3"
    | "cargoCategory"
    | "transportType"
    | "readyDate"
    | "description"
    | "declaredValueCents"
>;

export type SubmitRfqQuoteInput = Pick<
    RfqQuote,
    "priceCents" | "transitDays" | "validUntil" | "comment"
>;

/** What a given actor gets back: the RFQ as they are allowed to see it. */
export interface RfqView extends Omit<Rfq, "description" | "declaredValueCents"> {
    description?: string;
    declaredValueCents?: number;
    /** True when sensitive fields were withheld from this viewer. */
    detailsHidden: boolean;
    quotes: RfqQuote[];
}
