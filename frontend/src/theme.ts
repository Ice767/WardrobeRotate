import {createTheme} from "@mui/material/styles";

export const fonts = {
    display: "'Barlow Condensed', 'Arial Narrow', sans-serif",
    body: "'IBM Plex Sans', system-ui, sans-serif",
    small: "'Saira', 'Arial Narrow', sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, Consolas, monospace",
};

export const colors = {
    ground: "#eef1f4",
    surface: "#ffffff",
    ink: "#17212b",
    muted: "#55616d",
    rule: "#d3dae1",
    field: "#b8c3cd",
    accent: "#1d5a8c",
    accentSoft: "#e2edf6",
    instant: "#1f5c34",
    instantSoft: "#e1f1e6",
    request: "#8a5300",
    requestSoft: "#fbefd9",
};

// Radii follow the design canvas: 8 for cards, 6 for controls, 4 for tags.
export const theme = createTheme({
    palette: {
        primary: {main: colors.accent},
        warning: {main: colors.request},
        success: {main: colors.instant},
        background: {default: colors.ground, paper: colors.surface},
        text: {primary: colors.ink, secondary: colors.muted},
        divider: colors.rule,
    },
    shape: {borderRadius: 6},
    typography: {
        fontFamily: fonts.body,
        fontSize: 15,
        h1: {fontFamily: fonts.display, fontWeight: 700, fontSize: "2.75rem", lineHeight: 1},
        h2: {fontFamily: fonts.display, fontWeight: 600, fontSize: "1.65rem", lineHeight: 1.1},
        h3: {fontFamily: fonts.display, fontWeight: 700, fontSize: "2.1rem", lineHeight: 1},
        body2: {fontFamily: fonts.small, fontSize: "0.82rem"},
        caption: {fontFamily: fonts.small, fontSize: "0.75rem"},
        overline: {fontFamily: fonts.small, fontSize: "0.7rem", letterSpacing: "0.08em", lineHeight: 1.6},
        button: {textTransform: "none", fontWeight: 600},
    },
    components: {
        MuiButton: {
            defaultProps: {disableElevation: true},
            styleOverrides: {root: {minHeight: 44, paddingInline: 18}},
        },
        MuiPaper: {
            defaultProps: {elevation: 0, variant: "outlined"},
            styleOverrides: {root: {borderRadius: 8, borderColor: colors.rule}},
        },
        MuiInputLabel: {styleOverrides: {root: {fontFamily: fonts.small}}},
        MuiFormHelperText: {styleOverrides: {root: {fontFamily: fonts.small}}},
    },
});
