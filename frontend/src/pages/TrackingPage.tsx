import {Alert, Box, Button, Paper, TextField, Typography} from "@mui/material";
import {useState, type FormEvent} from "react";
import {useNavigate, useParams} from "react-router-dom";

import {errorText, useRegionsQuery, useTrackQuery} from "../api/api";
import type {ShipmentStatus} from "../api/types";
import {colors, fonts} from "../theme";

const STEPS: Array<{status: ShipmentStatus; label: string}> = [
    {status: "CONFIRMED", label: "Booked and confirmed"},
    {status: "PICKED_UP", label: "Picked up by the carrier"},
    {status: "IN_TRANSIT", label: "In transit"},
    {status: "DELIVERED", label: "Delivered"},
];

const STATUS_LABEL: Record<ShipmentStatus, string> = {
    CONFIRMED: "CONFIRMED",
    PICKED_UP: "PICKED UP",
    IN_TRANSIT: "IN TRANSIT",
    DELIVERED: "DELIVERED",
    CANCELLED: "CANCELLED",
};

const when = new Intl.DateTimeFormat("en-GB", {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"});

export const TrackingPage = () => {
    const {code} = useParams();
    const navigate = useNavigate();
    const [input, setInput] = useState(code ?? "");
    const {data: regions = []} = useRegionsQuery();
    const {data: tracking, error, isFetching} = useTrackQuery(code ?? "", {skip: !code});

    const name = (id: string) => regions.find((r) => r.regionId === id)?.name ?? "…";

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const trimmed = input.trim().toUpperCase();
        if (trimmed) navigate(`/track/${trimmed}`);
    };

    const reached = new Map(tracking?.history.map((event) => [event.status, event.at]));

    return (
        <Box component="main" sx={{maxWidth: 820, mx: "auto", px: {xs: 2, sm: 4}, py: 4, display: "flex", flexDirection: "column", gap: 3}}>
            <Box component="form" onSubmit={submit} sx={{display: "flex", flexWrap: "wrap", gap: 1.25, alignItems: "flex-start"}}>
                <TextField
                    id="code"
                    label="Tracking code"
                    placeholder="FM-7K2Q9XNA"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    sx={{flex: "1 1 260px"}}
                    slotProps={{htmlInput: {style: {fontFamily: fonts.mono, fontSize: 18, letterSpacing: "0.06em"}}}}
                />
                <Button type="submit" variant="contained" size="large" sx={{minHeight: 56}}>Track</Button>
            </Box>

            {error && <Alert severity="error">{errorText(error)}</Alert>}
            {isFetching && !tracking && <Typography color="text.secondary">Looking up {code}…</Typography>}

            {tracking && (
                <Paper component="section" aria-label="Shipment status">
                    <Box sx={{p: 3, borderBottom: `1px dashed ${colors.rule}`, display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 2, alignItems: "flex-end"}}>
                        <Box sx={{display: "flex", flexDirection: "column", gap: 0.75}}>
                            <Typography variant="overline" color="text.secondary">{tracking.trackingCode} · {tracking.transportType}</Typography>
                            <Typography variant="h3" component="h1">{name(tracking.fromRegionId)} → {name(tracking.toRegionId)}</Typography>
                        </Box>
                        <Box
                            component="span"
                            sx={{
                                fontFamily: fonts.small,
                                fontSize: 13,
                                px: 1.25,
                                py: 0.75,
                                borderRadius: "4px",
                                bgcolor: tracking.status === "CANCELLED" ? colors.requestSoft : tracking.status === "DELIVERED" ? colors.instantSoft : colors.accentSoft,
                                color: tracking.status === "CANCELLED" ? colors.request : tracking.status === "DELIVERED" ? colors.instant : colors.accent,
                            }}
                        >
                            {STATUS_LABEL[tracking.status]}
                        </Box>
                    </Box>

                    <Box component="ol" sx={{listStyle: "none", m: 0, p: 3, display: "flex", flexDirection: "column", gap: 2.75}}>
                        {(tracking.status === "CANCELLED"
                            ? [...STEPS.filter((s) => reached.has(s.status)), {status: "CANCELLED" as const, label: "Cancelled before pickup"}]
                            : STEPS
                        ).map((step) => {
                            const at = reached.get(step.status);
                            const current = step.status === tracking.status;

                            return (
                                <Box component="li" key={step.status} sx={{display: "grid", gridTemplateColumns: "24px minmax(0, 1fr) auto", gap: 2}}>
                                    <Box
                                        aria-hidden="true"
                                        sx={{
                                            width: 14,
                                            height: 14,
                                            mt: 0.5,
                                            boxSizing: "border-box",
                                            borderRadius: "50%",
                                            bgcolor: at ? (current ? colors.accent : colors.instant) : "transparent",
                                            border: at ? "none" : `2px solid ${colors.field}`,
                                            boxShadow: current && at ? `0 0 0 4px ${colors.accentSoft}` : "none",
                                        }}
                                    />
                                    <Typography sx={{fontWeight: at ? 600 : 400, color: at ? colors.ink : colors.muted}}>{step.label}</Typography>
                                    <Typography variant="body2" color="text.secondary">{at ? when.format(new Date(at)) : "not yet"}</Typography>
                                </Box>
                            );
                        })}
                    </Box>
                </Paper>
            )}

            <Typography variant="body2" color="text.secondary" sx={{maxWidth: "64ch"}}>
                Anyone with a code sees the route and the timeline. Price, sender and contents are visible only to the client and the carrier after signing in.
            </Typography>
        </Box>
    );
};
