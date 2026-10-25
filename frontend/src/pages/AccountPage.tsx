import {Alert, Box, Button, Paper, Typography} from "@mui/material";
import {Link as RouterLink, Navigate} from "react-router-dom";

import {
    errorText,
    useAcceptRfqQuoteMutation,
    useBookFromRfqMutation,
    useCarriersQuery,
    useMeQuery,
    useRegionsQuery,
    useRfqsQuery,
    useShipmentsQuery,
} from "../api/api";
import type {Rfq, Shipment} from "../api/types";
import {formatCents, formatDays} from "../lib/format";
import {colors, fonts} from "../theme";

const useNames = () => {
    const {data: regions = []} = useRegionsQuery();
    const {data: carriers = []} = useCarriersQuery();

    return {
        region: (id: string) => regions.find((r) => r.regionId === id)?.code ?? "…",
        carrier: (id: string) => carriers.find((c) => c.carrierId === id)?.name ?? "Carrier",
    };
};

const ShipmentRow = ({shipment}: {shipment: Shipment}) => {
    const names = useNames();

    return (
        <Paper sx={{p: 2, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1.5}}>
            <Box sx={{display: "flex", flexDirection: "column", gap: 0.5, minWidth: 0}}>
                <Typography sx={{fontWeight: 600}}>
                    {names.region(shipment.fromRegionId)} → {names.region(shipment.toRegionId)} · {names.carrier(shipment.carrierId)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {shipment.transportType} · {formatDays(shipment.transitDays)} · {formatCents(shipment.priceCents)} · {shipment.status.replace("_", " ")}
                </Typography>
            </Box>
            <Button component={RouterLink} to={`/track/${shipment.trackingCode}`} variant="outlined" sx={{fontFamily: fonts.mono}}>
                {shipment.trackingCode}
            </Button>
        </Paper>
    );
};

const RfqCard = ({rfq, bookedRfqIds}: {rfq: Rfq; bookedRfqIds: Set<string>}) => {
    const names = useNames();
    const [accept, acceptState] = useAcceptRfqQuoteMutation();
    const [book, bookState] = useBookFromRfqMutation();
    const booked = bookedRfqIds.has(rfq.rfqId) || !!bookState.data;

    return (
        <Paper sx={{p: 2, display: "flex", flexDirection: "column", gap: 1.5}}>
            <Box sx={{display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 1}}>
                <Typography sx={{fontWeight: 600}}>
                    {names.region(rfq.fromRegionId)} → {names.region(rfq.toRegionId)} · {rfq.weightKg} kg · {rfq.volumeM3} m³
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {rfq.status} · {rfq.eligibleCarrierIds.length} invited · {rfq.cargoCategory.replace("_", " ").toLowerCase()}
                </Typography>
            </Box>

            {rfq.quotes.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                    No answers yet. Carriers have until {new Date(rfq.expiresAt).toLocaleDateString("en-GB")}.
                </Typography>
            )}

            {rfq.quotes.map((quote) => (
                <Box
                    key={quote.quoteId}
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1.5,
                        p: 1.5,
                        borderRadius: "6px",
                        bgcolor: quote.status === "ACCEPTED" ? colors.instantSoft : colors.ground,
                        opacity: quote.status === "DECLINED" ? 0.6 : 1,
                    }}
                >
                    <Box sx={{minWidth: 0}}>
                        <Typography sx={{fontWeight: 600}}>
                            {names.carrier(quote.carrierId)} · {quote.transportType} · {formatDays(quote.transitDays)}
                        </Typography>
                        {quote.comment && <Typography variant="body2" color="text.secondary">{quote.comment}</Typography>}
                        <Typography variant="caption" color="text.secondary">
                            Valid until {new Date(quote.validUntil).toLocaleDateString("en-GB")}
                        </Typography>
                    </Box>
                    <Box sx={{display: "flex", alignItems: "center", gap: 1.5}}>
                        <Typography sx={{fontFamily: fonts.display, fontWeight: 700, fontSize: 26}}>{formatCents(quote.priceCents)}</Typography>
                        {rfq.status === "OPEN" && (
                            <Button variant="contained" disabled={acceptState.isLoading} onClick={() => accept({rfqId: rfq.rfqId, quoteId: quote.quoteId})}>
                                Accept
                            </Button>
                        )}
                        {quote.status === "ACCEPTED" && !booked && (
                            <Button variant="contained" disabled={bookState.isLoading} onClick={() => book(rfq.rfqId)}>Book</Button>
                        )}
                    </Box>
                </Box>
            ))}

            {bookState.data && (
                <Alert severity="success">
                    Booked. Tracking code{" "}
                    <RouterLink to={`/track/${bookState.data.trackingCode}`} style={{fontFamily: fonts.mono, fontWeight: 600}}>
                        {bookState.data.trackingCode}
                    </RouterLink>
                </Alert>
            )}
            {(acceptState.error || bookState.error) && <Alert severity="error">{errorText(acceptState.error ?? bookState.error)}</Alert>}
        </Paper>
    );
};

export const AccountPage = () => {
    const {data: me, isLoading: meLoading, isError} = useMeQuery();
    const {data: shipments = []} = useShipmentsQuery(undefined, {skip: !me});
    const {data: rfqs = []} = useRfqsQuery(undefined, {skip: !me});

    if (isError) {
        return <Navigate to="/signin" state={{from: "/account"}} replace />;
    }

    if (meLoading || !me) {
        return null;
    }

    const bookedRfqIds = new Set(shipments.flatMap((s) => (s.rfqId ? [s.rfqId] : [])));

    return (
        <Box component="main" sx={{maxWidth: 900, mx: "auto", px: {xs: 2, sm: 4}, py: 4, display: "flex", flexDirection: "column", gap: 3}}>
            <Typography variant="h1">Hello, {me.name}</Typography>

            {me.role !== "CLIENT" && (
                <Alert severity="info">
                    You are signed in as {me.role.toLowerCase()}. The carrier workspace (tariffs, answering requests, updating shipments) is not built yet; the API supports it.
                </Alert>
            )}

            <Box component="section" sx={{display: "flex", flexDirection: "column", gap: 1.5}}>
                <Typography variant="h2">Quote requests</Typography>
                {rfqs.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                        None yet. Dangerous goods, valuables and other special cargo are priced by request from the quote page.
                    </Typography>
                )}
                {rfqs.map((rfq) => <RfqCard key={rfq.rfqId} rfq={rfq} bookedRfqIds={bookedRfqIds} />)}
            </Box>

            <Box component="section" sx={{display: "flex", flexDirection: "column", gap: 1.5}}>
                <Typography variant="h2">Shipments</Typography>
                {shipments.length === 0 && (
                    <Typography variant="body2" color="text.secondary">Nothing booked yet.</Typography>
                )}
                {shipments.map((s) => <ShipmentRow key={s.shipmentId} shipment={s} />)}
            </Box>
        </Box>
    );
};
