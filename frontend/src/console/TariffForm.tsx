import {Alert, Box, Button, MenuItem, Paper, TextField, Typography} from "@mui/material";
import {useState, type FormEvent} from "react";

import {errorText, useCreateTariffMutation, useUpdateTariffMutation} from "../api/api";
import type {Region, Tariff, TransportType} from "../api/types";
import {RegionPicker} from "../components/RegionPicker";
import {fonts} from "../theme";
import {centsToInput, parseDollars} from "./money";

const MAX_TRANSIT_DAYS = 365;

interface Props {
    /** Absent when creating a tariff. */
    tariff?: Tariff;
    regions: Region[];
    modes: TransportType[];
    regionName: (id: string) => string;
    onDone: (tariff: Tariff) => void;
    onCancel: () => void;
}

// An empty price field means $0: a carrier that bills only by weight should
// not have to type a zero into the volume field.
const parse = (raw: string) => parseDollars(raw.trim() === "" ? "0" : raw);

const moneyError = (raw: string) => {
    const parsed = parse(raw);
    return "error" in parsed ? parsed.error : null;
};

const cents = (raw: string) => {
    const parsed = parse(raw);
    return "cents" in parsed ? parsed.cents : 0;
};

export const TariffForm = ({tariff, regions, modes, regionName, onDone, onCancel}: Props) => {
    const editing = tariff !== undefined;
    const [create, createState] = useCreateTariffMutation();
    const [update, updateState] = useUpdateTariffMutation();
    const state = editing ? updateState : createState;

    const [from, setFrom] = useState<Region | null>(null);
    const [to, setTo] = useState<Region | null>(null);
    const [mode, setMode] = useState<TransportType | "">(tariff?.transportType ?? modes[0] ?? "");
    const [perKg, setPerKg] = useState(tariff ? centsToInput(tariff.pricePerKgCents) : "");
    const [perM3, setPerM3] = useState(tariff ? centsToInput(tariff.pricePerM3Cents) : "");
    const [minimum, setMinimum] = useState(tariff ? centsToInput(tariff.minChargeCents) : "");
    const [days, setDays] = useState(tariff ? String(tariff.transitDays) : "");
    const [touched, setTouched] = useState(false);

    const daysNumber = Number(days.trim());
    const problems = {
        from: !editing && !from ? "Choose where the lane starts" : null,
        to: !editing && !to ? "Choose where the lane ends" : null,
        mode: !mode ? "Choose a mode" : null,
        perKg: moneyError(perKg),
        perM3: moneyError(perM3),
        minimum: moneyError(minimum),
        days: Number.isInteger(daysNumber) && daysNumber >= 1 && daysNumber <= MAX_TRANSIT_DAYS ? null : "Enter whole days from 1 to 365",
        rates: !moneyError(perKg) && !moneyError(perM3) && cents(perKg) === 0 && cents(perM3) === 0 ? "Set a price per kg or per m³; both cannot be zero" : null,
    };
    const valid = Object.values(problems).every((problem) => problem === null);
    const show = (problem: string | null) => (touched ? problem : null);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setTouched(true);

        if (!valid) {
            return;
        }

        const prices = {pricePerKgCents: cents(perKg), pricePerM3Cents: cents(perM3), minChargeCents: cents(minimum), transitDays: daysNumber};
        const result = editing
            ? await update({tariffId: tariff.tariffId, body: prices})
            : await create({fromRegionId: from!.regionId, toRegionId: to!.regionId, transportType: mode as TransportType, ...prices});

        if ("data" in result && result.data) {
            onDone(result.data);
        }
    };

    const money = {inputMode: "decimal" as const, style: {fontFamily: fonts.mono}};

    return (
        <Paper component="form" noValidate onSubmit={submit} className="enter" sx={{p: 2.5, display: "flex", flexDirection: "column", gap: 2}}>
            <Typography variant="h2">{editing ? "Edit tariff" : "New tariff"}</Typography>

            {editing ? (
                <Typography color="text.secondary">
                    {regionName(tariff.fromRegionId)} → {regionName(tariff.toRegionId)} · {tariff.transportType}. The lane and mode stay as they are; create a new tariff for another lane.
                </Typography>
            ) : (
                <Box sx={{display: "grid", gridTemplateColumns: {xs: "1fr", sm: "1fr 1fr 160px"}, gap: 1.5, alignItems: "start"}}>
                    <Box>
                        <RegionPicker id="tariff-from" label="From" regions={regions} value={from} onChange={setFrom} exclude={to?.regionId} />
                        {show(problems.from) && <Typography variant="caption" color="error">{problems.from}</Typography>}
                    </Box>
                    <Box>
                        <RegionPicker id="tariff-to" label="To" regions={regions} value={to} onChange={setTo} exclude={from?.regionId} />
                        {show(problems.to) && <Typography variant="caption" color="error">{problems.to}</Typography>}
                    </Box>
                    <TextField
                        id="tariff-mode"
                        select
                        label="Mode"
                        value={mode}
                        onChange={(e) => setMode(e.target.value as TransportType)}
                        error={!!show(problems.mode)}
                        helperText={show(problems.mode)}
                    >
                        {modes.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                    </TextField>
                </Box>
            )}

            <Box sx={{display: "grid", gridTemplateColumns: {xs: "1fr 1fr", sm: "repeat(4, minmax(0, 1fr))"}, gap: 1.5, alignItems: "start"}}>
                <TextField id="tariff-per-kg" label="$ per kg" value={perKg} onChange={(e) => setPerKg(e.target.value)} error={!!show(problems.perKg)} helperText={show(problems.perKg)} slotProps={{htmlInput: money}} />
                <TextField id="tariff-per-m3" label="$ per m³" value={perM3} onChange={(e) => setPerM3(e.target.value)} error={!!show(problems.perM3)} helperText={show(problems.perM3)} slotProps={{htmlInput: money}} />
                <TextField id="tariff-minimum" label="Minimum, $" value={minimum} onChange={(e) => setMinimum(e.target.value)} error={!!show(problems.minimum)} helperText={show(problems.minimum)} slotProps={{htmlInput: money}} />
                <TextField id="tariff-days" label="Transit, days" value={days} onChange={(e) => setDays(e.target.value)} error={!!show(problems.days)} helperText={show(problems.days)} slotProps={{htmlInput: {inputMode: "numeric", style: {fontFamily: fonts.mono}}}} />
            </Box>
            {show(problems.rates) && <Typography variant="caption" color="error">{problems.rates}</Typography>}

            {state.error && <Alert severity="error">{errorText(state.error)}</Alert>}

            <Box sx={{display: "flex", gap: 1.25, flexWrap: "wrap"}}>
                <Button type="submit" variant="contained" disabled={state.isLoading}>
                    {state.isLoading ? "Saving…" : editing ? "Save changes" : "Create tariff"}
                </Button>
                <Button variant="outlined" onClick={onCancel}>Cancel</Button>
            </Box>
        </Paper>
    );
};
