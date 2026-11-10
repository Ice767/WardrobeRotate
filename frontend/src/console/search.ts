import type {Rfq, Shipment, Tariff} from "../api/types";
import type {PillTone} from "../components/Pill";
import {formatCents} from "../lib/format";

export type SearchKind = "Tariff" | "Request" | "Shipment";

/** The pill colour of each kind of hit, shared by the dropdown and the results page. */
export const KIND_TONE: Record<SearchKind, PillTone> = {Tariff: "info", Request: "alert", Shipment: "neutral"};

export interface SearchHit {
    kind: SearchKind;
    id: string;
    title: string;
    sub: string;
    /** The section page, with the hit to highlight. */
    to: string;
}

export interface SearchData {
    tariffs: Tariff[];
    rfqs: Rfq[];
    shipments: Shipment[];
    regionName: (regionId: string) => string;
}

/** How a request is named in the console: short enough to read, unique enough to find. */
export const shortRfqId = (rfqId: string): string => `RFQ-${rfqId.slice(0, 8).toUpperCase()}`;

const label = (status: string) => status.replace("_", " ").toLowerCase();

/**
 * Filters what the console has already loaded. A plain substring test, not a
 * RegExp built from the query, so "(" or ".*" are just characters.
 */
export const searchConsole = (query: string, {tariffs, rfqs, shipments, regionName}: SearchData): SearchHit[] => {
    const needle = query.trim().toLowerCase();

    if (!needle) {
        return [];
    }

    const route = (from: string, to: string) => `${regionName(from)} → ${regionName(to)}`;

    const all: SearchHit[] = [
        ...tariffs.map((tariff) => ({
            kind: "Tariff" as const,
            id: tariff.tariffId,
            title: `${tariff.transportType} · ${formatCents(tariff.pricePerKgCents)} / kg`,
            sub: route(tariff.fromRegionId, tariff.toRegionId),
            to: `/console/tariffs?focus=${tariff.tariffId}`,
        })),
        ...rfqs.map((rfq) => ({
            kind: "Request" as const,
            id: rfq.rfqId,
            title: shortRfqId(rfq.rfqId),
            sub: `${route(rfq.fromRegionId, rfq.toRegionId)} · ${label(rfq.cargoCategory)}`,
            to: `/console/requests?focus=${rfq.rfqId}`,
        })),
        ...shipments.map((shipment) => ({
            kind: "Shipment" as const,
            id: shipment.shipmentId,
            title: shipment.trackingCode,
            sub: `${route(shipment.fromRegionId, shipment.toRegionId)} · ${label(shipment.status)}`,
            to: `/console/shipments?focus=${shipment.shipmentId}`,
        })),
    ];

    return all.filter((hit) => `${hit.title} ${hit.sub} ${hit.kind}`.toLowerCase().includes(needle));
};
