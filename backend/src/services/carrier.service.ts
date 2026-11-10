import type {Carrier} from "../contracts/carrier.contract";
import type {TransportType} from "../contracts/transport.contract";
import {carriersById} from "../data/store";
import {NotFoundError} from "../errors/app.error";
import {repos} from "../repositories";

export interface ListCarriersFilter {
    transportType?: TransportType;
}

export const listCarriers = (filter: ListCarriersFilter = {}): Carrier[] => {
    const carriers = [...carriersById.values()].filter((carrier) => {
        return (
            filter.transportType === undefined ||
            carrier.supportedTransportTypes.includes(filter.transportType)
        );
    });

    return carriers.sort((left, right) => left.name.localeCompare(right.name));
};

// carriersById is a read cache over the carriers table: the quote search reads
// it on every request without a round trip to the database. Storage is written
// first, so a carrier is never visible in memory and then lost on restart.

/** Writes the carriers defined in code into storage. Safe to repeat. */
export const saveSeededCarriers = async (): Promise<void> => {
    for (const carrier of carriersById.values()) {
        await repos().carriers.upsert(carrier);
    }
};

/** Fills the cache from storage: brings back carriers that joined through the site. */
export const loadCarriers = async (): Promise<void> => {
    for (const carrier of await repos().carriers.list()) {
        carriersById.set(carrier.carrierId, carrier);
    }
};

export const addCarrier = async (carrier: Carrier): Promise<void> => {
    await repos().carriers.upsert(carrier);
    carriersById.set(carrier.carrierId, carrier);
};

export const carrierExists =(carrierId: string): boolean => {
    return carriersById.has(carrierId);
};

export const getCarrierById = (carrierId: string): Carrier => {
    const carrier = carriersById.get(carrierId);

    if (!carrier) {
        throw new NotFoundError("Carrier not found");
    }

    return carrier;
};
