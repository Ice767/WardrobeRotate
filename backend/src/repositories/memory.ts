import type {StoredUser} from "../contracts/auth.contract";
import type {Carrier} from "../contracts/carrier.contract";
import type {Rfq, RfqQuote} from "../contracts/rfq.contract";
import type {Shipment} from "../contracts/shipment.contract";
import type {Tariff, TariffLaneKey} from "../contracts/tariff.contract";
import {DuplicateError, type Repositories, type Scope, type TariffFilter} from "./types";

const laneKeyOf = (lane: TariffLaneKey): string =>
    [lane.carrierId, lane.fromRegionId, lane.toRegionId, lane.transportType].join("|");

const newestFirst = <T extends {createdAt: string}>(items: T[]): T[] =>
    items.sort((left, right) => right.createdAt.localeCompare(left.createdAt));

/**
 * Process-memory storage for tests and for running locally without a database.
 * It follows the same contract as Postgres, checked by the shared contract tests,
 * but a restart loses everything and two processes never see each other's data.
 */
export const createMemoryRepositories = (): Repositories => {
    const carriers = new Map<string, Carrier>();
    const users = new Map<string, StoredUser>();
    const userIdByEmail = new Map<string, string>();
    const tariffs = new Map<string, Tariff>();
    const tariffIdByLane = new Map<string, string>();
    const rfqs = new Map<string, Rfq>();
    const quotes = new Map<string, RfqQuote>();
    const shipments = new Map<string, Shipment>();
    const shipmentIdByCode = new Map<string, string>();
    const shipmentIdByRfq = new Map<string, string>();

    const quotesOf = (rfqId: string): RfqQuote[] =>
        [...quotes.values()].filter((q) => q.rfqId === rfqId).sort((a, b) => a.priceCents - b.priceCents);

    const matches = (filter: TariffFilter, t: Tariff): boolean =>
        (filter.carrierId === undefined || t.carrierId === filter.carrierId) &&
        (filter.fromRegionId === undefined || t.fromRegionId === filter.fromRegionId) &&
        (filter.toRegionId === undefined || t.toRegionId === filter.toRegionId) &&
        (filter.transportType === undefined || t.transportType === filter.transportType);

    const inScope = (scope: Scope, clientId: string, carrierIds: string[]): boolean =>
        (scope.clientId === undefined || clientId === scope.clientId) &&
        (scope.carrierId === undefined || carrierIds.includes(scope.carrierId));

    const closeOpenRfq = (rfqId: string, patch: Partial<Rfq>, quoteStatus: (q: RfqQuote) => RfqQuote["status"], now: Date): boolean => {
        const rfq = rfqs.get(rfqId);

        if (!rfq || rfq.status !== "OPEN") {
            return false;
        }

        rfqs.set(rfqId, {...rfq, ...patch});
        for (const quote of quotesOf(rfqId)) {
            quotes.set(quote.quoteId, {...quote, status: quoteStatus(quote), updatedAt: now.toISOString()});
        }

        return true;
    };

    return {
        carriers: {
            // Copies both ways, so a caller changing its object cannot change what is stored.
            list: async () => [...carriers.values()].map((c) => structuredClone(c)),
            upsert: async (carrier) => {
                carriers.set(carrier.carrierId, structuredClone(carrier));
            },
        },

        users: {
            findById: async (id) => users.get(id),
            findByEmail: async (email) => {
                const id = userIdByEmail.get(email);
                return id === undefined ? undefined : users.get(id);
            },
            insert: async (user) => {
                if (userIdByEmail.has(user.email)) throw new DuplicateError("email");
                users.set(user.userId, user);
                userIdByEmail.set(user.email, user.userId);
            },
        },

        tariffs: {
            findById: async (id) => tariffs.get(id),
            findByLane: async (lane) => {
                const id = tariffIdByLane.get(laneKeyOf(lane));
                return id === undefined ? undefined : tariffs.get(id);
            },
            list: async (filter) => [...tariffs.values()].filter((t) => matches(filter, t)),
            listBetween: async (fromIds, toIds) =>
                [...tariffs.values()].filter((t) => fromIds.includes(t.fromRegionId) && toIds.includes(t.toRegionId)),
            insert: async (tariff) => {
                if (tariffIdByLane.has(laneKeyOf(tariff))) throw new DuplicateError("lane");
                tariffs.set(tariff.tariffId, tariff);
                tariffIdByLane.set(laneKeyOf(tariff), tariff.tariffId);
            },
            updatePrices: async (id, prices) => {
                const current = tariffs.get(id);
                if (current) tariffs.set(id, {...current, ...prices});
            },
            delete: async (id) => {
                const current = tariffs.get(id);
                if (!current) return;
                tariffs.delete(id);
                tariffIdByLane.delete(laneKeyOf(current));
            },
        },

        rfqs: {
            insert: async (rfq) => {
                rfqs.set(rfq.rfqId, rfq);
            },
            findById: async (id) => rfqs.get(id),
            list: async (scope) =>
                newestFirst([...rfqs.values()].filter((r) => inScope(scope, r.clientId, r.eligibleCarrierIds))),
            expireIfDue: async (id, now) => {
                const rfq = rfqs.get(id);
                if (!rfq || rfq.status !== "OPEN" || now.getTime() < Date.parse(rfq.expiresAt)) return false;
                rfqs.set(id, {...rfq, status: "EXPIRED"});
                return true;
            },
            quotesOf: async (id) => quotesOf(id),
            findQuote: async (id) => quotes.get(id),
            upsertQuote: async (quote) => {
                const existing = quotesOf(quote.rfqId).find((q) => q.carrierId === quote.carrierId);
                const stored = existing ? {...quote, quoteId: existing.quoteId, createdAt: existing.createdAt} : quote;
                quotes.set(stored.quoteId, stored);
                return stored;
            },
            accept: async (rfqId, quoteId, now) =>
                closeOpenRfq(rfqId, {status: "ACCEPTED", acceptedQuoteId: quoteId}, (q) => (q.quoteId === quoteId ? "ACCEPTED" : "DECLINED"), now),
            cancel: async (rfqId, now) => closeOpenRfq(rfqId, {status: "CANCELLED"}, () => "DECLINED", now),
        },

        shipments: {
            insert: async (shipment) => {
                if (shipmentIdByCode.has(shipment.trackingCode)) throw new DuplicateError("trackingCode");
                if (shipment.rfqId !== undefined && shipmentIdByRfq.has(shipment.rfqId)) throw new DuplicateError("rfqId");
                shipments.set(shipment.shipmentId, shipment);
                shipmentIdByCode.set(shipment.trackingCode, shipment.shipmentId);
                if (shipment.rfqId !== undefined) shipmentIdByRfq.set(shipment.rfqId, shipment.shipmentId);
            },
            findById: async (id) => shipments.get(id),
            findByTrackingCode: async (code) => {
                const id = shipmentIdByCode.get(code);
                return id === undefined ? undefined : shipments.get(id);
            },
            list: async (scope) =>
                newestFirst([...shipments.values()].filter((s) => inScope(scope, s.clientId, [s.carrierId]))),
            transition: async (next, expected) => {
                const current = shipments.get(next.shipmentId);
                if (!current || current.status !== expected) return false;
                shipments.set(next.shipmentId, next);
                return true;
            },
        },

        init: async () => {},
        close: async () => {},
    };
};
