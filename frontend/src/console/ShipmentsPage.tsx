import {Alert, Box, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography} from "@mui/material";
import {useState} from "react";
import {Link as RouterLink} from "react-router-dom";

import {errorText, useChangeShipmentStatusMutation, useRegionsQuery, useShipmentsQuery} from "../api/api";
import type {Shipment, ShipmentStatus} from "../api/types";
import {Pill, type PillTone} from "../components/Pill";
import {formatCents} from "../lib/format";
import {colors, fonts} from "../theme";
import {rowId, useFlashRow} from "./flash";
import {nextStatus, progressPercent} from "./shipmentSteps";
import {useToast} from "./toast";

const LABEL: Record<ShipmentStatus, string> = {
    CONFIRMED: "Confirmed",
    PICKED_UP: "Picked up",
    IN_TRANSIT: "In transit",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
};

const TONE: Record<ShipmentStatus, PillTone> = {
    CONFIRMED: "neutral",
    PICKED_UP: "info",
    IN_TRANSIT: "info",
    DELIVERED: "done",
    CANCELLED: "alert",
};

const HEAD = ["Tracking", "Route", "Price", "Status", "Progress", ""];

const Track = ({status}: {status: ShipmentStatus}) => (
    <Box sx={{width: 120, height: 6, borderRadius: 3, bgcolor: colors.line, overflow: "hidden"}} aria-label={`${progressPercent(status)}% done`}>
        <Box className="track-fill" sx={{height: "100%", width: `${progressPercent(status)}%`, bgcolor: status === "DELIVERED" ? colors.navy : colors.red}} />
    </Box>
);

export const ShipmentsPage = () => {
    const {data: shipments = [], isLoading, error} = useShipmentsQuery();
    const {data: regions = []} = useRegionsQuery();
    const [change] = useChangeShipmentStatusMutation();
    const [busyId, setBusyId] = useState<string | null>(null);
    const [failure, setFailure] = useState<string | null>(null);
    const toast = useToast();
    const {flashId, flash} = useFlashRow(shipments.map((s) => s.shipmentId));

    const regionName = (id: string) => regions.find((region) => region.regionId === id)?.name ?? "…";

    const advance = async (shipment: Shipment, to: ShipmentStatus) => {
        setBusyId(shipment.shipmentId);
        setFailure(null);
        const result = await change({shipmentId: shipment.shipmentId, status: to});
        setBusyId(null);

        if ("error" in result) {
            setFailure(`${shipment.trackingCode}: ${errorText(result.error)}`);
            return;
        }

        toast(`${shipment.trackingCode} is now ${LABEL[to].toLowerCase()}`);
        flash(shipment.shipmentId);
    };

    return (
        <Box className="enter" sx={{display: "flex", flexDirection: "column", gap: 2.5}}>
            <Box>
                <Typography variant="h1">Shipments</Typography>
                <Typography color="text.secondary">Move each shipment along as the cargo moves. The client sees every step on the tracking page.</Typography>
            </Box>

            {error && <Alert severity="error">{errorText(error)}</Alert>}
            {failure && <Alert severity="error" onClose={() => setFailure(null)}>{failure}</Alert>}

            {!isLoading && !error && shipments.length === 0 && (
                <Paper sx={{p: 3, borderStyle: "dashed"}}>
                    <Typography color="text.secondary">No shipments yet. They appear here once a client books one of your offers.</Typography>
                </Paper>
            )}

            {shipments.length > 0 && (
                <TableContainer component={Paper}>
                    <Table size="small" aria-label="Shipments">
                        <TableHead>
                            <TableRow>
                                {HEAD.map((title, i) => (
                                    <TableCell key={i} sx={{color: colors.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap"}}>
                                        {title}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {shipments.map((shipment, index) => {
                                const next = nextStatus(shipment.status);
                                const flashing = flashId === shipment.shipmentId;

                                return (
                                    <TableRow
                                        key={shipment.shipmentId}
                                        id={rowId(shipment.shipmentId)}
                                        className={flashing ? "row-flash" : "stagger"}
                                        style={flashing ? undefined : {animationDelay: `${index * 60}ms`}}
                                    >
                                        <TableCell sx={{whiteSpace: "nowrap"}}>
                                            <Box component={RouterLink} to={`/track/${shipment.trackingCode}`} sx={{fontFamily: fonts.mono, color: colors.navy, fontWeight: 500}}>
                                                {shipment.trackingCode}
                                            </Box>
                                        </TableCell>
                                        <TableCell>{regionName(shipment.fromRegionId)} → {regionName(shipment.toRegionId)}</TableCell>
                                        <TableCell sx={{fontFamily: fonts.mono, whiteSpace: "nowrap"}}>{formatCents(shipment.priceCents)}</TableCell>
                                        <TableCell>
                                            <Box component="span" className={shipment.status === "IN_TRANSIT" ? "pulse" : undefined}>
                                                <Pill tone={TONE[shipment.status]}>{LABEL[shipment.status]}</Pill>
                                            </Box>
                                        </TableCell>
                                        <TableCell><Track status={shipment.status} /></TableCell>
                                        <TableCell align="right" sx={{whiteSpace: "nowrap"}}>
                                            {next ? (
                                                <Button size="small" variant="contained" disabled={busyId === shipment.shipmentId} onClick={() => advance(shipment, next)}>
                                                    Mark {LABEL[next].toLowerCase()}
                                                </Button>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary">{shipment.status === "DELIVERED" ? "Complete" : "Cancelled"}</Typography>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
};
