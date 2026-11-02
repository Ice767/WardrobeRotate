import {CARGO_CATEGORY_SPECS} from "../contracts/cargo.contract";
import type {Quote, QuoteRequest} from "../contracts/quote.contract";
import type {Tariff} from "../contracts/tariff.contract";
import {TRANSPORT_TYPE_SPECS, type TransportType} from "../contracts/transport.contract";
import {carriersById, regionsById} from "../data/store";
import {BadRequestError} from "../errors/app.error";
import {repos} from "../repositories";
import {calculatePrice} from "./price.calculator";
import {getRegionPath} from "./region.service";

const laneKeyOf = (carrierId: string, fromRegionId: string, toRegionId: string, transportType: TransportType): string =>
    [carrierId, fromRegionId, toRegionId, transportType].join("|");

// Region chains reversed to run from the region itself up to its country:
// [Tel Aviv, Tel Aviv District, Israel].
const chainUpward = (regionId: string): string[] => {
    return getRegionPath(regionId).map((region) => region.regionId).reverse();
};

/**
 * Lane pairs from most to least specific. Specificity is how many steps up the
 * hierarchy both ends had to climb, combined; on a tie the more exact origin
 * wins, since pickup is where the carrier commits equipment first.
 *
 * The first lane found wins even if a broader one is cheaper: a carrier that
 * priced Tel Aviv -> Chicago specifically meant that price for that trip.
 */
const findMostSpecificTariff = (
    byLane: Map<string, Tariff>,
    carrierId: string,
    transportType: TransportType,
    fromChain: string[],
    toChain: string[],
): Tariff | undefined => {
    const maxRank = fromChain.length + toChain.length - 2;

    for (let rank = 0; rank <= maxRank; rank += 1) {
        for (let up = 0; up <= rank; up += 1) {
            const fromRegionId = fromChain[up];
            const toRegionId = toChain[rank - up];

            if (fromRegionId === undefined || toRegionId === undefined) {
                continue;
            }

            const tariff = byLane.get(laneKeyOf(carrierId, fromRegionId, toRegionId, transportType));

            if (tariff) {
                return tariff;
            }
        }
    }

    return undefined;
};

const priceOf = (quote: Quote): number => {
    return quote.priceCents ?? quote.priceRangeCents?.min ?? 0;
};

export const findQuotes = async (request: QuoteRequest): Promise<Quote[]> => {
    if (!regionsById.has(request.fromRegionId)) {
        throw new BadRequestError("Unknown fromRegionId");
    }

    if (!regionsById.has(request.toRegionId)) {
        throw new BadRequestError("Unknown toRegionId");
    }

    const fromChain = chainUpward(request.fromRegionId);
    const toChain = chainUpward(request.toRegionId);

    // One read for the whole search: every tariff whose ends lie on the two
    // chains. Picking the narrowest per carrier then happens in memory, instead
    // of a database round trip per candidate lane.
    const candidates = await repos().tariffs.listBetween(fromChain, toChain);
    const byLane = new Map(candidates.map((t) => [laneKeyOf(t.carrierId, t.fromRegionId, t.toRegionId, t.transportType), t]));
    const category = CARGO_CATEGORY_SPECS[request.cargoCategory];
    const quotes: Quote[] = [];

    for (const carrier of carriersById.values()) {
        if (!carrier.acceptedCargoCategories.includes(request.cargoCategory)) {
            continue;
        }

        for (const transportType of carrier.supportedTransportTypes) {
            if (request.transportType !== undefined && transportType !== request.transportType) {
                continue;
            }

            const spec = TRANSPORT_TYPE_SPECS[transportType];

            if (request.weightKg > spec.maxWeightKg || request.volumeM3 > spec.maxVolumeM3) {
                continue;
            }

            const tariff = findMostSpecificTariff(byLane, carrier.carrierId, transportType, fromChain, toChain);

            if (!tariff) {
                continue;
            }

            const quote: Quote = {
                carrierId: carrier.carrierId,
                carrierName: carrier.name,
                transportType,
                transitDays: tariff.transitDays,
                pricingMode: category.pricingMode,
                matchedFromRegionId: tariff.fromRegionId,
                matchedToRegionId: tariff.toRegionId,
            };

            // ON_REQUEST never runs the calculator: there is no number to leak.
            if (category.pricingMode !== "ON_REQUEST") {
                const breakdown = calculatePrice({
                    tariff,
                    weightKg: request.weightKg,
                    volumeM3: request.volumeM3,
                    volumetricFactorKgPerM3: spec.volumetricFactorKgPerM3,
                });

                if (category.pricingMode === "INSTANT") {
                    quote.priceCents = breakdown.totalCents;
                    quote.breakdown = breakdown;
                } else if (category.indicativeMultiplier) {
                    quote.priceRangeCents = {
                        min: Math.ceil(breakdown.totalCents * category.indicativeMultiplier.min),
                        max: Math.ceil(breakdown.totalCents * category.indicativeMultiplier.max),
                    };
                }
            }

            quotes.push(quote);
        }
    }

    return quotes.sort((left, right) => {
        return priceOf(left) - priceOf(right) || left.transitDays - right.transitDays;
    });
};
