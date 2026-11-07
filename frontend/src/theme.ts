import {createTheme} from "@mui/material/styles";

export const fonts = {
    body: "'Inter', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, Consolas, monospace",
    // Old names, kept until the client pages are restyled.
    display: "'Inter', system-ui, sans-serif",
    small: "'Inter', system-ui, sans-serif",
};

const red = "#E63946";
const cream = "#F1FAEE";
const navy = "#1D3557";
const aqua = "#A8DADC";
const line = "#e5e7eb";

export const colors = {
    red,
    cream,
    navy,
    aqua,
    surface: "#ffffff",
    line,
    muted: "#4a5d78",
    ink: navy,
    // Old names, kept until the client pages are restyled.
    ground: cream,
    rule: line,
    field: "#cfd6df",
    accent: navy,
    accentSoft: "rgba(168, 218, 220, 0.35)",
    instant: navy,
    instantSoft: aqua,
    request: red,
    requestSoft: "rgba(230, 57, 70, 0.1)",
};

// Radii follow the mockup: 10 for cards, 8 for controls.
export const theme = createTheme({
    palette: {
        primary: {main: red},
        background: {default: cream, paper: colors.surface},
        text: {primary: navy, secondary: colors.muted},
        divider: line,
    },
    shape: {borderRadius: 8},
    typography: {
        fontFamily: fonts.body,
        fontSize: 15,
        h1: {fontWeight: 600, fontSize: "1.75rem", lineHeight: 1.2},
        h2: {fontWeight: 600, fontSize: "1.25rem", lineHeight: 1.3},
        h3: {fontWeight: 600, fontSize: "1.5rem", lineHeight: 1.25},
        body2: {fontSize: "0.82rem"},
        caption: {fontSize: "0.75rem"},
        overline: {fontSize: "0.7rem", fontWeight: 500, letterSpacing: "0.08em", lineHeight: 1.6},
        button: {textTransform: "none", fontWeight: 600},
    },
    components: {
        MuiButton: {
            defaultProps: {disableElevation: true, className: "btn-lift"},
            styleOverrides: {root: {minHeight: 44, paddingInline: 18, borderRadius: 8}},
        },
        MuiPaper: {
            defaultProps: {elevation: 0, variant: "outlined"},
            styleOverrides: {root: {borderRadius: 10, borderColor: line}},
        },
    },
});
