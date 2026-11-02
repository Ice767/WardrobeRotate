import type {StoredUser} from "../contracts/auth.contract";
import type {Rfq, RfqQuote} from "../contracts/rfq.contract";
import type {Shipment, ShipmentStatus} from "../contracts/shipment.contract";
import type {Tariff, TariffLaneKey, TariffPrices} from "../contracts/tariff.contract";
import type {TransportType} from "../contracts/transport.contract";

/**
 * A uniqueness rule was broken. Raised by the storage itself — a UNIQUE
 * constraint in Postgres, the index Map in memory — so two concurrent requests
 * cannot both slip past a "does it exist yet?" check.
 */
export class DuplicateError extends Error {
    constructor(public readonly field: "email" | "lane" | "trackingCode" | "rfqId") {
        super(`Duplicate ${field}`);
        this.name = "DuplicateError";
    }
}

export interface TariffFilter {
    carrierId?: string;
    fromRegionId?: string;
    toRegionId?: string;
    transportType?: TransportType;
}

/** Who a list is for. No field set means everything (admin). */
export interface Scope {
    clientId?: string;
    carrierId?: string;
}

export interface UserRepository {
    findById(userId: string): Promise<StoredUser | undefined>;
    findByEmail(email: string): Promise<StoredUser | undefined>;
    insert(user: StoredUser): Promise<void>;
}

export interface TariffRepository {
    findById(tariffId: string): Promise<Tariff | undefined>;
    findByLane(lane: TariffLaneKey): Promise<Tariff | undefined>;
    list(filter: TariffFilter): Promise<Tariff[]>;
    /** Every tariff whose ends lie on the two region chains — one round trip per search. */
    listBetween(fromRegionIds: string[], toRegionIds: string[]): Promise<Tariff[]>;
    insert(tariff: Tariff): Promise<void>;
    updatePrices(tariffId: string, prices: TariffPrices): Promise<void>;
    delete(tariffId: string): Promise<void>;
}

export interface RfqRepository {
    insert(rfq: Rfq): Promise<void>;
    findById(rfqId: string): Promise<Rfq | undefined>;
    /** Newest first. A carrier scope means "RFQs this carrier was invited to". */
    list(scope: Scope): Promise<Rfq[]>;
    /** OPEN and past its deadline → EXPIRED. True if this call made the change. */
    expireIfDue(rfqId: string, now: Date): Promise<boolean>;
    quotesOf(rfqId: string): Promise<RfqQuote[]>;
    findQuote(quoteId: string): Promise<RfqQuote | undefined>;
    /** One quote per carrier per RFQ: a second submission replaces the first. */
    upsertQuote(quote: RfqQuote): Promise<RfqQuote>;
    /** Atomic: only succeeds while the RFQ is still OPEN. */
    accept(rfqId: string, quoteId: string, now: Date): Promise<boolean>;
    /** Atomic: only succeeds while the RFQ is still OPEN. */
    cancel(rfqId: string, now: Date): Promise<boolean>;
}

export interface ShipmentRepository {
    insert(shipment: Shipment): Promise<void>;
    findById(shipmentId: string): Promise<Shipment | undefined>;
    findByTrackingCode(trackingCode: string): Promise<Shipment | undefined>;
    list(scope: Scope): Promise<Shipment[]>;
    /** Writes `next` only if the stored status is still `expected`. */
    transition(next: Shipment, expected: ShipmentStatus): Promise<boolean>;
}

export interface Repositories {
    users: UserRepository;
    tariffs: TariffRepository;
    rfqs: RfqRepository;
    shipments: ShipmentRepository;
    /** Creates tables when they are missing. A no-op in memory. */
    init(): Promise<void>;
    close(): Promise<void>;
}
