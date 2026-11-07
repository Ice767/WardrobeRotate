import {Alert, Box, Button, MenuItem, Paper, TextField, Typography} from "@mui/material";
import {useMemo, useState, type FormEvent} from "react";
import {Link as RouterLink} from "react-router-dom";

import {
    errorText,
    useCargoCategoriesQuery,
    useCreateRfqMutation,
    useMeQuery,
    useQuotesMutation,
    useRegionsQuery,
} from "../api/api";
import type {CargoCategory, QuoteRequest, Region} from "../api/types";
import {OfferCard} from "../components/OfferCard";
import {RegionPicker} from "../components/RegionPicker";
import {pickHighlights} from "../lib/format";
import {searched, useAppDispatch, useAppSelector} from "../store";
import {colors, fonts} from "../theme";

const CATEGORY_TAGS: Partial<Record<CargoCategory, string>> = {
    DANGEROUS: "DGR",
    TEMPERATURE_CONTROLLED: "PER",
    OVERSIZED: "HEA",
    VALUABLE: "VAL",
    LIVE_ANIMALS: "AVI",
};

const Section = ({children}: {children: string}) => (
    <Typography variant="overline" color="text.secondary" component="div">{children}</Typography>
);

export const QuotePage = () => {
    const {data: regions = [], isLoading: regionsLoading, isError: regionsFailed, refetch: reloadRegions} = useRegionsQuery();
    const {data: categories = []} = useCargoCategoriesQuery();
    const {data: me} = useMeQuery();
    // A fixed cache key keeps the last results alive while the client goes off
    // to sign in, and the request itself is kept in the store beside them, so
    // "Sign in to book" brings them back to the same offers.
    const [search, result] = useQuotesMutation({fixedCacheKey: "quote-search"});
    const [requestRfq, rfqResult] = useCreateRfqMutation();
    const dispatch = useAppDispatch();
    const last = useAppSelector((state) => state.search.lastRequest) ?? undefined;
    const byId = useMemo(() => new Map(regions.map((r) => [r.regionId, r])), [regions]);

    const [from, setFrom] = useState<Region | null>(null);
    const [to, setTo] = useState<Region | null>(null);
    const [weight, setWeight] = useState(last ? String(last.weightKg) : "");
    const [volume, setVolume] = useState(last ? String(last.volumeM3) : "");
    const [category, setCategory] = useState<CargoCategory>(last?.cargoCategory ?? "GENERAL");
    const [touched, setTouched] = useState(false);

    const fromValue = from ?? (last ? byId.get(last.fromRegionId) ?? null : null);
    const toValue = to ?? (last ? byId.get(last.toRegionId) ?? null : null);
    const weightKg = Number(weight);
    const volumeM3 = Number(volume);

    const problems = {
        from: !fromValue ? "Choose where the cargo starts" : null,
        to: !toValue ? "Choose the destination" : null,
        weight: !(weightKg > 0) ? "Enter the weight in kilograms" : null,
        volume: !(volumeM3 > 0) ? "Enter the volume in cubic meters" : null,
    };
    const valid = Object.values(problems).every((p) => p === null);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        setTouched(true);

        if (!valid || !fromValue || !toValue) {
            return;
        }

        const request: QuoteRequest = {fromRegionId: fromValue.regionId, toRegionId: toValue.regionId, weightKg, volumeM3, cargoCategory: category};
        rfqResult.reset();
        dispatch(searched(request));
        search(request);
    };

    const quotes = result.data ?? [];
    const request: QuoteRequest | undefined = last;
    const mode = categories.find((c) => c.category === request?.cargoCategory)?.pricingMode ?? "INSTANT";
    const {cheapest, fastest} = pickHighlights(quotes);
    const carrierCount = new Set(quotes.map((q) => q.carrierId)).size;
    const name = (id: string) => byId.get(id)?.name ?? "…";
    const code = (id: string) => byId.get(id)?.code ?? "";

    return (
        <Box component="main" sx={{maxWidth: 1200, mx: "auto", px: {xs: 2, sm: 4}, py: 4, display: "flex", flexDirection: "column", gap: 3}}>
            <Box sx={{display: "flex", flexDirection: "column", gap: 0.75}}>
                <Typography variant="h1">Price a shipment</Typography>
                <Typography color="text.secondary" sx={{maxWidth: "62ch"}}>
                    Enter the route and the cargo. Every carrier that can take it answers with a price, a range, or an offer to quote.
                </Typography>
            </Box>

            <Box sx={{display: "flex", flexWrap: "wrap", gap: 3, alignItems: "flex-start"}}>
                <Paper component="form" noValidate onSubmit={submit} sx={{flex: "1 1 320px", minWidth: 0, p: 2.5, display: "flex", flexDirection: "column", gap: 2}}>
                    <Section>Route</Section>
                    {regionsFailed && (
                        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => reloadRegions()}>Try again</Button>}>
                            The list of cities could not be loaded.
                        </Alert>
                    )}
                    <RegionPicker id="from" label="From" regions={regions} value={fromValue} onChange={setFrom} exclude={toValue?.regionId} loading={regionsLoading} />
                    {touched && problems.from && <Typography variant="caption" color="error">{problems.from}</Typography>}
                    <RegionPicker id="to" label="To" regions={regions} value={toValue} onChange={setTo} exclude={fromValue?.regionId} loading={regionsLoading} />
                    {touched && problems.to && <Typography variant="caption" color="error">{problems.to}</Typography>}

                    <Section>Cargo</Section>
                    <Box sx={{display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.5}}>
                        <TextField
                            id="weight"
                            label="Weight, kg"
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            error={touched && !!problems.weight}
                            helperText={touched ? problems.weight : undefined}
                            slotProps={{htmlInput: {inputMode: "decimal", style: {fontFamily: fonts.mono}}}}
                        />
                        <TextField
                            id="volume"
                            label="Volume, m³"
                            value={volume}
                            onChange={(e) => setVolume(e.target.value)}
                            error={touched && !!problems.volume}
                            helperText={touched ? problems.volume : undefined}
                            slotProps={{htmlInput: {inputMode: "decimal", style: {fontFamily: fonts.mono}}}}
                        />
                    </Box>
                    <TextField
                        id="category"
                        select
                        label="What is it?"
                        value={category}
                        onChange={(e) => setCategory(e.target.value as CargoCategory)}
                        helperText="Special cargo gets a price range or a quote request instead of an instant price."
                    >
                        {(categories.length ? categories : [{category: "GENERAL" as const, label: "General cargo"}]).map((c) => (
                            <MenuItem key={c.category} value={c.category}>{c.label}</MenuItem>
                        ))}
                    </TextField>
                    <Button type="submit" variant="contained" size="large" disabled={result.isLoading}>
                        {result.isLoading ? "Looking for offers…" : "Show offers"}
                    </Button>
                </Paper>

                <Box component="section" aria-label="Offers" sx={{flex: "999 1 560px", minWidth: 0, display: "flex", flexDirection: "column", gap: 1.75}}>
                    {result.error && <Alert severity="error">{errorText(result.error)}</Alert>}

                    {!request && !result.isLoading && (
                        <Paper sx={{p: 3, borderStyle: "dashed", borderColor: colors.field}}>
                            <Typography sx={{fontWeight: 600}}>Offers appear here</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Try Ashdod → Houston, 2000 kg, 20 m³ to compare sea and air.
                            </Typography>
                        </Paper>
                    )}

                    {request && result.data && (
                        <>
                            <Typography variant="h2">
                                {quotes.length === 1 ? "1 offer" : `${quotes.length} offers`} · {code(request.fromRegionId)} → {code(request.toRegionId)}
                            </Typography>

                            {quotes.length === 0 && (
                                <Paper sx={{p: 2.5, borderStyle: "dashed", borderColor: colors.field}}>
                                    <Typography sx={{fontWeight: 600}}>No carrier takes this shipment yet</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        No lane covers this route for this cargo, or it is over every mode's weight or volume limit. Try a nearby city, or split the load.
                                    </Typography>
                                </Paper>
                            )}

                            {quotes.length > 0 && mode !== "INSTANT" && (
                                <Paper sx={{p: 2.5, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 2, bgcolor: mode === "ON_REQUEST" ? colors.requestSoft : colors.accentSoft, borderColor: "transparent"}}>
                                    <Box sx={{minWidth: 0, flex: "1 1 280px"}}>
                                        <Typography sx={{fontWeight: 600}}>
                                            {mode === "ON_REQUEST" ? "These carriers price this cargo on request" : "These prices are a range until the carrier confirms handling"}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {carrierCount === 1
                                                ? "The request goes to this carrier, who answers with a firm price you can accept."
                                                : `One request goes to all ${carrierCount} carriers; each answers with a firm price you can accept.`}
                                        </Typography>
                                    </Box>
                                    {rfqResult.data ? (
                                        <Button component={RouterLink} to="/account" variant="outlined">Request sent · view answers</Button>
                                    ) : me ? (
                                        <Button
                                            variant="contained"
                                            color={mode === "ON_REQUEST" ? "warning" : "primary"}
                                            disabled={rfqResult.isLoading}
                                            onClick={() => requestRfq(request)}
                                        >
                                            {rfqResult.isLoading ? "Sending…" : "Request firm prices"}
                                        </Button>
                                    ) : (
                                        <Button component={RouterLink} to="/signin" state={{from: "/"}} variant="outlined">Sign in to request</Button>
                                    )}
                                </Paper>
                            )}
                            {rfqResult.error && <Alert severity="error">{errorText(rfqResult.error)}</Alert>}

                            {quotes.map((quote) => (
                                <OfferCard
                                    key={`${quote.carrierId}-${quote.transportType}`}
                                    quote={quote}
                                    request={request}
                                    laneLabel={`${name(quote.matchedFromRegionId)} → ${name(quote.matchedToRegionId)} lane`}
                                    highlight={quote === cheapest ? "Cheapest" : quote === fastest ? "Fastest" : undefined}
                                    signedIn={!!me}
                                    categoryTag={CATEGORY_TAGS[request.cargoCategory]}
                                />
                            ))}

                            {quotes.length > 0 && mode === "INSTANT" && (
                                <Typography variant="body2" color="text.secondary" sx={{maxWidth: "70ch"}}>
                                    Prices are final for general cargo and fixed when you book. Light, bulky cargo is billed by the space it takes: air counts one cubic meter as 167 kg.
                                </Typography>
                            )}
                        </>
                    )}
                </Box>
            </Box>
        </Box>
    );
};
