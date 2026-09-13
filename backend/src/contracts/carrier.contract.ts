import type {TransportType} from "./transport.contract";

export interface Carrier {
    carrierId: string;
    /** The brand a client sees. */
    name: string;
    /** The legal entity — goes onto the shipping paperwork. */
    legalName: string;
    supportedTransportTypes: TransportType[];
}
