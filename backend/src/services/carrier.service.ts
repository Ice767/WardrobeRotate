import type {Carrier} from "../contracts/carrier.contract";
import type {TransportType} from "../contracts/transport.contract";
import {carriersById} from "../data/store";
import {NotFoundError} from "../errors/app.error";

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

export const getCarrierById = (carrierId: string): Carrier => {
    const carrier = carriersById.get(carrierId);

    if (!carrier) {
        throw new NotFoundError("Carrier not found");
    }

    return carrier;
};
