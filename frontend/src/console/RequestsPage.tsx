import {Alert, Box, Paper, Typography} from "@mui/material";
import {useEffect, useMemo, useState} from "react";

import {errorText, useCargoCategoriesQuery, useCarriersQuery, useCurrentUser, useRegionsQuery, useRfqsQuery} from "../api/api";
import {useFlashRow} from "./flash";
import {RequestCard} from "./RequestCard";
import {requestState, type RequestState} from "./requests";
import {useToast} from "./useToast";

const ORDER: Record<RequestState, number> = {open: 0, answered: 1, closed: 2};

/** The clock, ticking once a minute so expiry times and states stay current. */
const useMinuteClock = () => {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(timer);
    }, []);

    return now;
};

export const RequestsPage = () => {
    const me = useCurrentUser();
    const carrierId = me?.carrierId ?? "";
    const {data: rfqs = [], isLoading, error} = useRfqsQuery();
    const {data: regions = []} = useRegionsQuery();
    const {data: categories = []} = useCargoCategoriesQuery();
    const {data: carriers = []} = useCarriersQuery();
    const toast = useToast();
    const now = useMinuteClock();
    const {flashId, flash} = useFlashRow(rfqs.map((rfq) => rfq.rfqId));

    const modes = carriers.find((carrier) => carrier.carrierId === carrierId)?.supportedTransportTypes ?? [];
    const regionName = (id: string) => regions.find((region) => region.regionId === id)?.name ?? "…";
    const categoryLabel = (category: string) => categories.find((c) => c.category === category)?.label ?? category.replace("_", " ").toLowerCase();

    // Only requests sent to this carrier; the most urgent open ones first.
    const sorted = useMemo(
        () =>
            rfqs
                .filter((rfq) => rfq.eligibleCarrierIds.includes(carrierId))
                .map((rfq) => ({rfq, state: requestState(rfq, carrierId, now)}))
                .sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.rfq.expiresAt.localeCompare(b.rfq.expiresAt)),
        [rfqs, carrierId, now],
    );

    const answered = (rfqId: string) => {
        toast("Price sent to the client");
        flash(rfqId);
    };

    return (
        <Box className="enter" sx={{display: "flex", flexDirection: "column", gap: 2.5}}>
            <Box>
                <Typography variant="h1">Quote requests</Typography>
                <Typography color="text.secondary">
                    Special cargo has no instant price. Clients ask; you answer with a firm price that holds until the request expires.
                </Typography>
            </Box>

            {error && <Alert severity="error">{errorText(error)}</Alert>}

            {!isLoading && !error && sorted.length === 0 && (
                <Paper sx={{p: 3, borderStyle: "dashed"}}>
                    <Typography color="text.secondary">No requests yet. They appear here when a client asks for a price on a lane you serve.</Typography>
                </Paper>
            )}

            <Box sx={{display: "flex", flexDirection: "column", gap: 1.5}}>
                {sorted.map(({rfq, state}, index) => (
                    <RequestCard
                        key={rfq.rfqId}
                        rfq={rfq}
                        state={state}
                        carrierId={carrierId}
                        modes={modes}
                        route={`${regionName(rfq.fromRegionId)} → ${regionName(rfq.toRegionId)}`}
                        categoryLabel={categoryLabel(rfq.cargoCategory)}
                        now={now}
                        index={index}
                        flashing={flashId === rfq.rfqId}
                        onAnswered={answered}
                    />
                ))}
            </Box>
        </Box>
    );
};
