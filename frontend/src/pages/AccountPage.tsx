import {Alert, Box, Button, Paper, Typography} from "@mui/material";
import {alpha} from "@mui/material/styles";
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
import type {Rfq, RfqStatus, Shipment, ShipmentStatus} from "../api/types";
import {Pill, type PillTone} from "../components/Pill";
import {formatCents, formatDays} from "../lib/format";
import {sessionUser} from "../lib/session";
import {colors, fonts} from "../theme";

const SHIPMENT_TONE: Record<ShipmentStatus, PillTone> = {
    CONFIRMED: "info",
    PICKED_UP: "info",
    IN_TRANSIT: "info",
    DELIVERED: "done",
    CANCELLED: "alert",
};

const RFQ_TONE: Record<RfqStatus, PillTone> = {
    OPEN: "info",
    ACCEPTED: "done",
    EXPIRED: "neutral",
    CANCELLED: "alert",
};

const label = (status: string) => status.charAt(0) + status.slice(1).replace("_", " ").toLowerCase();

const useNames = () => {
    const {data: regions = []} = useRegionsQuery();
    const {data: carriers = []} = useCarriersQuery();

    return {
        region: (id: string) => regions.find((r) => r.regionId === id)?.code ?? "…",
        carrier: (id: string) => carriers.find((c) => c.carrierId === id)?.name ?? "Carrier",
    };
};

const ShipmentRow = ({shipment, index}: {shipment: Shipment; index: number}) => {
    const names = useNames();

    return (
        <Paper
            className="stagger card-hover"
            style={{animationDelay: `${index * 60}ms`}}
            sx={{p: 2, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1.5}}
        >
            <Box sx={{display: "flex", flexDirection: "column", gap: 0.5, minWidth: 0}}>
                <Box sx={{display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1}}>
                    <Typography sx={{fontWeight: 600}}>
                        {names.region(shipment.fromRegionId)} → {names.region(shipment.toRegionId)} · {names.carrier(shipment.carrierId)}
                    </Typography>
                    <Pill tone={SHIPMENT_TONE[shipment.status]}>{label(shipment.status)}</Pill>
                </Box>
                <Typography variant="body2" color="text.secondary">
                    {shipment.transportType} · {formatDays(shipment.transitDays)} ·{" "}
                    <Box component="span" sx={{fontFamily: fonts.mono}}>{formatCents(shipment.priceCents)}</Box>
                </Typography>
            </Box>
            <Button component={RouterLink} to={`/track/${shipment.trackingCode}`} variant="outlined" sx={{fontFamily: fonts.mono}}>
                {shipment.trackingCode}
            </Button>
        </Paper>
    );
};

const RfqCard = ({rfq, bookedRfqIds, index}: {rfq: Rfq; bookedRfqIds: Set<string>; index: number}) => {
    const names = useNames();
    const [accept, acceptState] = useAcceptRfqQuoteMutation();
    const [book, bookState] = useBookFromRfqMutation();
    const booked = bookedRfqIds.has(rfq.rfqId) || !!bookState.data;

    return (
        <Paper className="stagger" style={{animationDelay: `${index * 60}ms`}} sx={{p: 2, display: "flex", flexDirection: "column", gap: 1.5}}>
            <Box sx={{display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1}}>
                <Typography sx={{fontWeight: 600}}>
                    {names.region(rfq.fromRegionId)} → {names.region(rfq.toRegionId)} ·{" "}
                    <Box component="span" sx={{fontFamily: fonts.mono, fontWeight: 500}}>{rfq.weightKg} kg · {rfq.volumeM3} m³</Box>
                </Typography>
                <Box sx={{display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1}}>
                    <Typography variant="body2" color="text.secondary">
                        {rfq.eligibleCarrierIds.length} invited · {rfq.cargoCategory.replace("_", " ").toLowerCase()}
                    </Typography>
                    <Pill tone={RFQ_TONE[rfq.status]}>{label(rfq.status)}</Pill>
                </Box>
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
                        borderRadius: "8px",
                        bgcolor: quote.status === "ACCEPTED" ? alpha(colors.aqua, 0.4) : colors.cream,
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
                        <Typography sx={{fontFamily: fonts.mono, fontWeight: 500, fontSize: 22}}>{formatCents(quote.priceCents)}</Typography>
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
                <Alert severity="success" className="enter">
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
    const {data, error, isLoading: meLoading, refetch} = useMeQuery();
    const me = sessionUser(data, error);
    const {data: shipments = []} = useShipmentsQuery(undefined, {skip: !me});
    const {data: rfqs = []} = useRfqsQuery(undefined, {skip: !me});

    if (meLoading) {
        return null;
    }

    // Only "not signed in" sends to the sign-in page; a backend that is down or
    // waking up is not a reason to ask for the password again.
    if (!me && error) {
        const signedOut = (error as {status?: unknown}).status === 401;

        return signedOut ? (
            <Navigate to="/signin" state={{from: "/account"}} replace />
        ) : (
            <Box component="main" sx={{maxWidth: 900, mx: "auto", px: {xs: 2, sm: 4}, py: 4}}>
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => refetch()}>Try again</Button>}>
                    {errorText(error)}
                </Alert>
            </Box>
        );
    }

    if (!me) {
        return null;
    }

    // A carrier's work lives in the console; this page is the client's.
    if (me.role === "MANAGER") {
        return <Navigate to="/console" replace />;
    }

    const bookedRfqIds = new Set(shipments.flatMap((s) => (s.rfqId ? [s.rfqId] : [])));

    return (
        <Box component="main" className="enter" sx={{maxWidth: 900, mx: "auto", px: {xs: 2, sm: 4}, py: 4, display: "flex", flexDirection: "column", gap: 3}}>
            <Typography variant="h1">Hello, {me.name}</Typography>

            <Box component="section" sx={{display: "flex", flexDirection: "column", gap: 1.5}}>
                <Typography variant="h2">Quote requests</Typography>
                {rfqs.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                        None yet. Dangerous goods, valuables and other special cargo are priced by request from the quote page.
                    </Typography>
                )}
                {rfqs.map((rfq, index) => <RfqCard key={rfq.rfqId} rfq={rfq} bookedRfqIds={bookedRfqIds} index={index} />)}
            </Box>

            <Box component="section" sx={{display: "flex", flexDirection: "column", gap: 1.5}}>
                <Typography variant="h2">Shipments</Typography>
                {shipments.length === 0 && (
                    <Typography variant="body2" color="text.secondary">Nothing booked yet.</Typography>
                )}
                {shipments.map((s, index) => <ShipmentRow key={s.shipmentId} shipment={s} index={index} />)}
            </Box>
        </Box>
    );
};
