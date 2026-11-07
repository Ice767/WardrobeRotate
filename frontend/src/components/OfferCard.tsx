import {Alert, Box, Button, Paper, Typography} from "@mui/material";
import {Link as RouterLink} from "react-router-dom";

import {errorText, useBookInstantMutation} from "../api/api";
import type {Quote, QuoteRequest} from "../api/types";
import {describeBasis, formatCents, formatDays, formatRange} from "../lib/format";
import {colors, fonts} from "../theme";
import {Pill} from "./Pill";

interface Props {
    quote: Quote;
    request: QuoteRequest;
    laneLabel: string;
    highlight?: "Cheapest" | "Fastest";
    signedIn: boolean;
    categoryTag?: string;
    /** Position in the list, for the staggered entrance. */
    index: number;
}

export const OfferCard = ({quote, request, laneLabel, highlight, signedIn, categoryTag, index}: Props) => {
    const [book, {data: shipment, error, isLoading}] = useBookInstantMutation();
    const basis = describeBasis(quote, request.volumeM3);

    const price =
        quote.priceCents !== undefined ? (
            formatCents(quote.priceCents)
        ) : quote.priceRangeCents ? (
            formatRange(quote.priceRangeCents)
        ) : (
            <Box component="span" sx={{color: colors.muted, fontFamily: fonts.body, fontSize: 16, fontWeight: 500}}>Price on request</Box>
        );

    return (
        <Paper
            component="article"
            className="stagger card-hover"
            style={{animationDelay: `${index * 60}ms`}}
            sx={{p: {xs: 2, sm: 2.5}, display: "flex", flexDirection: "column", gap: 1.5}}
        >
            <Box sx={{display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "12px 24px", alignItems: "center"}}>
                <Box sx={{display: "flex", flexDirection: "column", gap: 0.75, minWidth: 0}}>
                    <Box sx={{display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1}}>
                        <Typography component="h3" sx={{fontWeight: 600, fontSize: 17}}>{quote.carrierName}</Typography>
                        <Pill>{quote.transportType}</Pill>
                        {categoryTag && <Pill tone={quote.pricingMode === "ON_REQUEST" ? "alert" : "info"}>{categoryTag}</Pill>}
                        {highlight && <Pill tone={highlight === "Cheapest" ? "done" : "info"}>{highlight}</Pill>}
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                        {formatDays(quote.transitDays)} · {laneLabel}
                    </Typography>
                    {basis && <Typography variant="caption" color="text.secondary">{basis}</Typography>}
                </Box>

                <Box sx={{display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1}}>
                    <Typography component="p" sx={{fontFamily: fonts.mono, fontWeight: 500, fontSize: {xs: 22, sm: 26}, lineHeight: 1.1, textAlign: "right"}}>
                        {price}
                    </Typography>
                    {quote.pricingMode === "INSTANT" && !shipment && (
                        signedIn ? (
                            <Button variant="contained" disabled={isLoading} onClick={() => book({...request, carrierId: quote.carrierId, transportType: quote.transportType})}>
                                {isLoading ? "Booking…" : "Book"}
                            </Button>
                        ) : (
                            <Button variant="outlined" component={RouterLink} to="/signin" state={{from: "/"}}>
                                Sign in to book
                            </Button>
                        )
                    )}
                </Box>
            </Box>

            {shipment && (
                <Alert severity="success" className="enter">
                    Booked at {formatCents(shipment.priceCents)}. Tracking code{" "}
                    <RouterLink to={`/track/${shipment.trackingCode}`} style={{fontFamily: fonts.mono, fontWeight: 600}}>
                        {shipment.trackingCode}
                    </RouterLink>
                </Alert>
            )}
            {error && <Alert severity="error">{errorText(error)}</Alert>}
        </Paper>
    );
};
