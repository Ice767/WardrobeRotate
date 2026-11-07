import {Autocomplete, TextField} from "@mui/material";
import {useMemo} from "react";

import type {Region} from "../api/types";
import {countryOf} from "../lib/format";

interface Option {
    region: Region;
    country: string;
}

interface Props {
    id: string;
    label: string;
    regions: Region[];
    value: Region | null;
    onChange: (region: Region | null) => void;
    exclude?: string;
    loading?: boolean;
}

// Grouped by country and searchable by name or code, so typing "TLV" or
// "Tel" both work. Districts and countries are offered too: a tariff may be
// set at that level, and a shipper may not know the exact city yet.
export const RegionPicker = ({id, label, regions, value, onChange, exclude, loading = false}: Props) => {
    const options = useMemo(() => {
        const byId = new Map(regions.map((r) => [r.regionId, r]));

        return regions
            .filter((r) => r.regionId !== exclude)
            .map((region) => ({region, country: countryOf(region, byId).name}))
            .sort((a, b) => a.country.localeCompare(b.country) || a.region.name.localeCompare(b.region.name));
    }, [regions, exclude]);

    const selected = options.find((o) => o.region.regionId === value?.regionId) ?? null;

    return (
        <Autocomplete<Option>
            id={id}
            options={options}
            loading={loading}
            loadingText="Loading cities… this can take up to a minute"
            value={selected}
            onChange={(_event, option) => onChange(option?.region ?? null)}
            groupBy={(option) => option.country}
            getOptionLabel={(option) => `${option.region.name} · ${option.region.code}`}
            isOptionEqualToValue={(a, b) => a.region.regionId === b.region.regionId}
            renderInput={(params) => <TextField {...params} label={label} />}
        />
    );
};
