import {Alert, Box, Button, MenuItem, Paper, TextField, Typography} from "@mui/material";
import {useState, type FormEvent} from "react";

import {errorText, useSubmitRfqQuoteMutation} from "../api/api";
import type {Rfq, TransportType} from "../api/types";
import {Pill, type PillTone} from "../components/Pill";
import {formatCents, formatDays} from "../lib/format";
import {colors, fonts} from "../theme";
import {rowId} from "./flash";
import {MAX_QUOTE_CENTS, parseDollars} from "./money";
import {expiresIn, type RequestState} from "./requests";
import {shortRfqId} from "./search";

const MAX_TRANSIT_DAYS = 365;
const MAX_COMMENT = 1000;

const STATE_PILL: Record<RequestState, {label: string; tone: PillTone}> = {
    open: {label: "Needs your price", tone: "info"},
    answered: {label: "Answered", tone: "done"},
    closed: {label: "Closed", tone: "neutral"},
};

const CLOSED_REASON: Record<Rfq["status"], string> = {
    OPEN: "The time to answer is over.",
    ACCEPTED: "The client accepted a price.",
    CANCELLED: "The client cancelled the request.",
    EXPIRED: "The time to answer is over.",
};

interface Props {
    rfq: Rfq;
    state: RequestState;
    carrierId: string;
    modes: TransportType[];
    route: string;
    categoryLabel: string;
    now: Date;
    index: number;
    flashing: boolean;
    onAnswered: (rfqId: string) => void;
}

const AnswerForm = ({rfq, modes, onAnswered}: {rfq: Rfq; modes: TransportType[]; onAnswered: (rfqId: string) => void}) => {
    const [submit, state] = useSubmitRfqQuoteMutation();
    const [mode, setMode] = useState<TransportType | "">(modes[0] ?? "");
    const [price, setPrice] = useState("");
    const [days, setDays] = useState("");
    const [comment, setComment] = useState("");
    const [touched, setTouched] = useState(false);

    const parsed = parseDollars(price, MAX_QUOTE_CENTS);
    const daysNumber = Number(days.trim());
    const problems = {
        mode: !mode ? "Choose a mode" : null,
        price: "error" in parsed ? parsed.error : parsed.cents === 0 ? "Enter a price above zero" : null,
        days: Number.isInteger(daysNumber) && daysNumber >= 1 && daysNumber <= MAX_TRANSIT_DAYS ? null : "Enter whole days from 1 to 365",
        comment: comment.trim().length > MAX_COMMENT ? `Keep the note under ${MAX_COMMENT} characters` : null,
    };
    const valid = Object.values(problems).every((problem) => problem === null);
    const show = (problem: string | null) => (touched ? problem : null);

    const send = async (event: FormEvent) => {
        event.preventDefault();
        setTouched(true);

        if (!valid || !("cents" in parsed)) {
            return;
        }

        const result = await submit({
            rfqId: rfq.rfqId,
            body: {
                transportType: mode as TransportType,
                priceCents: parsed.cents,
                transitDays: daysNumber,
                // The price holds as long as the request itself is open.
                validUntil: rfq.expiresAt,
                ...(comment.trim() && {comment: comment.trim()}),
            },
        });

        if (!("error" in result)) {
            onAnswered(rfq.rfqId);
        }
    };

    return (
        <Box component="form" noValidate onSubmit={send} sx={{display: "flex", flexDirection: "column", gap: 1.5, pt: 1.5, borderTop: `1px dashed ${colors.line}`}}>
            <Box sx={{display: "grid", gridTemplateColumns: {xs: "1fr 1fr", sm: "140px 1fr 1fr"}, gap: 1.5, alignItems: "start"}}>
                <TextField select size="small" label="Mode" value={mode} onChange={(e) => setMode(e.target.value as TransportType)} error={!!show(problems.mode)} helperText={show(problems.mode)}>
                    {modes.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </TextField>
                <TextField
                    size="small"
                    label="Price, $"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    error={!!show(problems.price)}
                    helperText={show(problems.price)}
                    slotProps={{htmlInput: {inputMode: "decimal", style: {fontFamily: fonts.mono}}}}
                />
                <TextField
                    size="small"
                    label="Transit, days"
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    error={!!show(problems.days)}
                    helperText={show(problems.days)}
                    slotProps={{htmlInput: {inputMode: "numeric", style: {fontFamily: fonts.mono}}}}
                />
            </Box>
            <TextField
                size="small"
                label="Note for the client (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                error={!!show(problems.comment)}
                helperText={show(problems.comment) ?? "For example what the price includes."}
                multiline
                minRows={1}
            />
            {state.error && <Alert severity="error">{errorText(state.error)}</Alert>}
            <Box>
                <Button type="submit" variant="contained" disabled={state.isLoading}>{state.isLoading ? "Sending…" : "Send price"}</Button>
            </Box>
        </Box>
    );
};

export const RequestCard = ({rfq, state, carrierId, modes, route, categoryLabel, now, index, flashing, onAnswered}: Props) => {
    const ours = rfq.quotes.find((quote) => quote.carrierId === carrierId);
    const pill = STATE_PILL[state];

    return (
        <Paper
            id={rowId(rfq.rfqId)}
            className={flashing ? "row-flash" : state === "closed" ? "stagger" : "stagger card-hover"}
            style={flashing ? undefined : {animationDelay: `${index * 60}ms`}}
            sx={{p: 2, display: "flex", flexDirection: "column", gap: 1.25, opacity: state === "closed" ? 0.65 : 1}}
        >
            <Box sx={{display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1}}>
                <Typography sx={{fontFamily: fonts.mono, fontWeight: 500}}>{shortRfqId(rfq.rfqId)}</Typography>
                <Pill tone="alert">{categoryLabel}</Pill>
                <Pill tone={pill.tone}>{pill.label}</Pill>
                {state !== "closed" && (
                    <Typography variant="body2" color="text.secondary" sx={{ml: "auto"}}>{expiresIn(rfq.expiresAt, now)}</Typography>
                )}
            </Box>

            <Box>
                <Typography sx={{fontWeight: 600}}>{route}</Typography>
                <Typography variant="body2" color="text.secondary">
                    <Box component="span" sx={{fontFamily: fonts.mono}}>{rfq.weightKg} kg · {rfq.volumeM3} m³</Box>
                </Typography>
            </Box>

            {state === "open" && <AnswerForm rfq={rfq} modes={modes} onAnswered={onAnswered} />}

            {ours && (
                <Typography variant="body2">
                    Price sent: <Box component="span" sx={{fontFamily: fonts.mono, fontWeight: 600}}>{formatCents(ours.priceCents)}</Box> · {ours.transportType} · {formatDays(ours.transitDays)} ·{" "}
                    {ours.status === "ACCEPTED" ? "the client accepted it" : ours.status === "DECLINED" ? "the client chose another offer" : "waiting for the client"}
                </Typography>
            )}

            {state === "closed" && !ours && <Typography variant="body2" color="text.secondary">{CLOSED_REASON[rfq.status]}</Typography>}
        </Paper>
    );
};
