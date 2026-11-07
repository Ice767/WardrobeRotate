import {useMemo} from "react";

import {useRegionsQuery, useRfqsQuery, useShipmentsQuery, useTariffsQuery} from "../api/api";
import type {SearchData} from "./search";

/** What the search filters: the same cached lists the console sections show. */
export const useSearchData = (): SearchData => {
    const {data: tariffs = []} = useTariffsQuery();
    const {data: rfqs = []} = useRfqsQuery();
    const {data: shipments = []} = useShipmentsQuery();
    const {data: regions = []} = useRegionsQuery();

    return useMemo(() => {
        const byId = new Map(regions.map((region) => [region.regionId, region.name]));
        return {tariffs, rfqs, shipments, regionName: (id: string) => byId.get(id) ?? "…"};
    }, [tariffs, rfqs, shipments, regions]);
};
