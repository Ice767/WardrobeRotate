import type {TransportType} from "./transport.contract";

// Money is stored as integer cents. Floating-point dollars drift (0.1 + 0.2 is
// not 0.3), and a pricing engine that multiplies by weight and sums surcharges
// would amplify that drift into visible pennies. One currency for now; the
// field names carry the unit so a later multi-currency change cannot be missed.
export const TARIFF_CURRENCY = "USD";

export interface Tariff {
    tariffId: string;
    carrierId: string;
    fromRegionId: string;
    toRegionId: string;
    transportType: TransportType;
    pricePerKgCents: number;
    pricePerM3Cents: number;
    /** Floor for small shipments: the carrier never moves anything for less. */
    minChargeCents: number;
    transitDays: number;
}

/** The fields that identify a lane. At most one tariff exists per lane. */
export type TariffLaneKey = Pick<
    Tariff,
    "carrierId" | "fromRegionId" | "toRegionId" | "transportType"
>;

export type TariffPrices = Pick<
    Tariff,
    "pricePerKgCents" | "pricePerM3Cents" | "minChargeCents" | "transitDays"
>;

export type CreateTariffInput = Omit<TariffLaneKey, "carrierId"> &
    TariffPrices & {carrierId?: string};

export type UpdateTariffInput = Partial<TariffPrices>;

/** Who is acting. Scoping decisions are made on this, not on the raw request. */
export interface TariffActor {
    role: "MANAGER" | "ADMIN";
    carrierId?: string;
}
