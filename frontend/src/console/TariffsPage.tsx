import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";
import {alpha} from "@mui/material/styles";
import {useMemo, useState} from "react";

import {errorText, useCarriersQuery, useCurrentUser, useDeleteTariffMutation, useRegionsQuery, useTariffsQuery} from "../api/api";
import type {Tariff} from "../api/types";
import {Pill} from "../components/Pill";
import {formatCents, formatDays} from "../lib/format";
import {colors, fonts} from "../theme";
import {rowId, useFlashRow} from "./flash";
import {TariffForm} from "./TariffForm";
import {useToast} from "./toast";

type Editing = {kind: "create"} | {kind: "edit"; tariff: Tariff} | null;

export const TariffsPage = () => {
    const me = useCurrentUser();
    const {data: tariffs = [], isLoading, error} = useTariffsQuery();
    const {data: regions = []} = useRegionsQuery();
    const {data: carriers = []} = useCarriersQuery();
    const [remove, removeState] = useDeleteTariffMutation();
    const toast = useToast();

    const [editing, setEditing] = useState<Editing>(null);
    const [deleting, setDeleting] = useState<Tariff | null>(null);
    const {flashId, flash} = useFlashRow(tariffs.map((t) => t.tariffId));

    const regionName = useMemo(() => {
        const byId = new Map(regions.map((region) => [region.regionId, region.name]));
        return (id: string) => byId.get(id) ?? "…";
    }, [regions]);
    const modes = carriers.find((carrier) => carrier.carrierId === me?.carrierId)?.supportedTransportTypes ?? [];

    const done = (tariff: Tariff, message: string) => {
        setEditing(null);
        toast(message);
        flash(tariff.tariffId);
    };

    const confirmDelete = async () => {
        if (!deleting) {
            return;
        }

        const result = await remove(deleting.tariffId);

        if (!("error" in result)) {
            toast("Tariff deleted");
            setDeleting(null);
        }
    };

    return (
        <Box className="enter" sx={{display: "flex", flexDirection: "column", gap: 2.5}}>
            <Box sx={{display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1.5}}>
                <Box>
                    <Typography variant="h1">Tariffs</Typography>
                    <Typography color="text.secondary">Your prices per lane. Clients see only the computed price for their shipment, never this table.</Typography>
                </Box>
                {editing?.kind !== "create" && (
                    <Button variant="contained" onClick={() => setEditing({kind: "create"})}>Create tariff</Button>
                )}
            </Box>

            {editing && (
                <TariffForm
                    key={editing.kind === "edit" ? editing.tariff.tariffId : "new"}
                    tariff={editing.kind === "edit" ? editing.tariff : undefined}
                    regions={regions}
                    modes={modes}
                    regionName={regionName}
                    onDone={(tariff) => done(tariff, editing.kind === "edit" ? "Tariff updated" : "Tariff created")}
                    onCancel={() => setEditing(null)}
                />
            )}

            {error && <Alert severity="error">{errorText(error)}</Alert>}

            {!isLoading && tariffs.length === 0 && !error && (
                <Paper sx={{p: 3, borderStyle: "dashed"}}>
                    <Typography color="text.secondary">No tariffs yet. Create one to start getting instant bookings on that lane.</Typography>
                </Paper>
            )}

            {tariffs.length > 0 && (
                <TableContainer component={Paper}>
                    <Table size="small" aria-label="Tariffs">
                        <TableHead>
                            <TableRow>
                                {["Lane", "Mode", "Per kg", "Per m³", "Minimum", "Transit", "Status", ""].map((title) => (
                                    <TableCell key={title} sx={{color: colors.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap"}}>
                                        {title}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {tariffs.map((tariff, index) => (
                                <TableRow
                                    key={tariff.tariffId}
                                    id={rowId(tariff.tariffId)}
                                    className={flashId === tariff.tariffId ? "row-flash" : "stagger"}
                                    style={flashId === tariff.tariffId ? undefined : {animationDelay: `${index * 60}ms`}}
                                    sx={{transition: "background-color 0.15s ease", "&:hover": {bgcolor: alpha(colors.aqua, 0.18)}}}
                                >
                                    <TableCell sx={{fontWeight: 600, minWidth: 180}}>
                                        {regionName(tariff.fromRegionId)} → {regionName(tariff.toRegionId)}
                                    </TableCell>
                                    <TableCell><Pill>{tariff.transportType}</Pill></TableCell>
                                    <TableCell sx={{fontFamily: fonts.mono}}>{formatCents(tariff.pricePerKgCents)}</TableCell>
                                    <TableCell sx={{fontFamily: fonts.mono}}>{formatCents(tariff.pricePerM3Cents)}</TableCell>
                                    <TableCell sx={{fontFamily: fonts.mono}}>{formatCents(tariff.minChargeCents)}</TableCell>
                                    <TableCell sx={{whiteSpace: "nowrap"}}>{formatDays(tariff.transitDays)}</TableCell>
                                    <TableCell>
                                        <Pill tone="info">
                                            <Box component="span" className="pulse" aria-hidden="true" sx={{width: 6, height: 6, borderRadius: "50%", bgcolor: colors.navy, mr: 0.75}} />
                                            Active
                                        </Pill>
                                    </TableCell>
                                    <TableCell align="right" sx={{whiteSpace: "nowrap"}}>
                                        <Button size="small" sx={{minHeight: 32}} onClick={() => setEditing({kind: "edit", tariff})}>Edit</Button>
                                        <Button size="small" color="inherit" sx={{minHeight: 32, color: colors.muted}} onClick={() => setDeleting(tariff)}>Delete</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* No scroll lock: the reserved scrollbar gutter would otherwise be padded twice (see theme.ts). */}
            <Dialog open={deleting !== null} onClose={() => setDeleting(null)} disableScrollLock>
                <DialogTitle>Delete this tariff?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {deleting && `${regionName(deleting.fromRegionId)} → ${regionName(deleting.toRegionId)} · ${deleting.transportType}. `}
                        Clients stop getting instant prices from you on this lane. Bookings already made keep their price.
                    </DialogContentText>
                    {removeState.error && <Alert severity="error" sx={{mt: 2}}>{errorText(removeState.error)}</Alert>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleting(null)}>Keep it</Button>
                    <Button variant="contained" onClick={confirmDelete} disabled={removeState.isLoading}>Delete</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};
