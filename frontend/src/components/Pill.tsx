import {Box} from "@mui/material";
import {alpha} from "@mui/material/styles";
import type {ReactNode} from "react";

import {colors} from "../theme";

export type PillTone = "neutral" | "info" | "done" | "alert";

// The brand red is too light for 12 px text on a pale background, so alert
// text uses a darker shade of it.
const ALERT_TEXT = "#b8202d";

const tones: Record<PillTone, {color: string; bgcolor: string; borderColor: string}> = {
    neutral: {color: colors.muted, bgcolor: "transparent", borderColor: colors.line},
    info: {color: colors.navy, bgcolor: alpha(colors.aqua, 0.4), borderColor: "transparent"},
    done: {color: colors.surface, bgcolor: colors.navy, borderColor: "transparent"},
    alert: {color: ALERT_TEXT, bgcolor: alpha(colors.red, 0.1), borderColor: "transparent"},
};

/** A rounded status or tag label. */
export const Pill = ({children, tone = "neutral"}: {children: ReactNode; tone?: PillTone}) => (
    <Box
        component="span"
        sx={{
            display: "inline-flex",
            alignItems: "center",
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1.5,
            letterSpacing: "0.02em",
            px: 1,
            borderRadius: 999,
            border: "1px solid",
            whiteSpace: "nowrap",
            ...tones[tone],
        }}
    >
        {children}
    </Box>
);
