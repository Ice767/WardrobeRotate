import type {CargoCategory} from "./cargo.contract";
import type {TransportType} from "./transport.contract";

export interface Carrier {
    carrierId: string;
    /** The brand a client sees. */
    name: string;
    /** The legal entity — goes onto the shipping paperwork. */
    legalName: string;
    supportedTransportTypes: TransportType[];
    /**
     * What the carrier is certified and equipped to handle. A carrier without
     * dangerous-goods certification never appears in a DANGEROUS search.
     */
    acceptedCargoCategories: CargoCategory[];
}
