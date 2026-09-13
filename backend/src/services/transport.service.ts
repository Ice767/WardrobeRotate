import {
    TRANSPORT_TYPE_SPECS,
    type TransportTypeSpec,
} from "../contracts/transport.contract";

export const listTransportTypeSpecs = (): TransportTypeSpec[] => {
    return Object.values(TRANSPORT_TYPE_SPECS);
};
