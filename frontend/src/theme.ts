import {createTheme} from "@mui/material/styles";

export const fonts = {
    body: "'Inter', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, Consolas, monospace",
};

export const colors = {
    red: "#E63946",
    cream: "#F1FAEE",
    navy: "#1D3557",
    aqua: "#A8DADC",
    surface: "#ffffff",
    line: "#e5e7eb",
    muted: "#4a5d78",
    ink: "#1D3557",
};

// Radii follow the mockup: 10 for cards, 8 for controls.
export const theme = createTheme({
    palette: {
        primary: {main: colors.red},
        background: {default: colors.cream, paper: colors.surface},
        text: {primary: colors.ink, secondary: colors.muted},
        divider: colors.line,
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
        // Reserves the scrollbar's width on every page, so a page tall enough to
        // scroll does not sit further left than a short one.
        MuiCssBaseline: {styleOverrides: {html: {scrollbarGutter: "stable"}}},
        // The scroll lock pads the body by that same width, shifting it twice.
        MuiPopover: {defaultProps: {disableScrollLock: true}},
        MuiButton: {
            defaultProps: {disableElevation: true, className: "btn-lift"},
            styleOverrides: {root: {minHeight: 44, paddingInline: 18, borderRadius: 8}},
        },
        MuiPaper: {
            defaultProps: {elevation: 0, variant: "outlined"},
            styleOverrides: {root: {borderRadius: 10, borderColor: colors.line}},
        },
    },
});
