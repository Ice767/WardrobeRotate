import type {CargoCategory, PricingMode} from "./cargo.contract";
import type {TransportType} from "./transport.contract";
import type {PriceBreakdown} from "../services/price.calculator";

export interface QuoteRequest {
    fromRegionId: string;
    toRegionId: string;
    weightKg: number;
    volumeM3: number;
    cargoCategory: CargoCategory;
    transportType?: TransportType;
}

export interface Quote {
    carrierId: string;
    carrierName: string;
    transportType: TransportType;
    transitDays: number;
    pricingMode: PricingMode;
    /** The lane that matched, which may be broader than the trip requested. */
    matchedFromRegionId: string;
    matchedToRegionId: string;
    /** INSTANT only. */
    priceCents?: number;
    /** INDICATIVE only. */
    priceRangeCents?: {min: number; max: number};
    /** INSTANT only: how the figure was reached. */
    breakdown?: PriceBreakdown;
}
