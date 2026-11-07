import {Box} from "@mui/material";
import {alpha} from "@mui/material/styles";
import {useEffect, useRef, useState} from "react";
import {NavLink} from "react-router-dom";

import {colors, fonts} from "../theme";

export interface ConsoleNavItem {
    to: string;
    label: string;
    /** Undefined while the data is loading: no badge rather than a wrong zero. */
    count?: number;
}

/** A count that bumps when it changes, but not when the page first shows it. */
const CountBadge = ({count, active}: {count: number; active: boolean}) => {
    const first = useRef(count);
    const [changed, setChanged] = useState(false);

    useEffect(() => {
        if (count !== first.current) {
            setChanged(true);
        }
    }, [count]);

    return (
        <Box
            component="span"
            // A new key restarts the animation on every change.
            key={changed ? count : "initial"}
            className={changed ? "bump" : undefined}
            sx={{
                ml: "auto",
                minWidth: 22,
                px: 0.75,
                borderRadius: 999,
                fontFamily: fonts.mono,
                fontSize: 12,
                lineHeight: "20px",
                textAlign: "center",
                bgcolor: active ? colors.surface : alpha(colors.navy, 0.07),
                color: colors.navy,
            }}
        >
            {count}
        </Box>
    );
};

export const ConsoleNav = ({items}: {items: ConsoleNavItem[]}) => (
    <Box
        component="nav"
        aria-label="Console"
        sx={{
            bgcolor: colors.surface,
            borderRight: {md: `1px solid ${colors.line}`},
            borderBottom: {xs: `1px solid ${colors.line}`, md: "none"},
            p: 1.25,
            display: "flex",
            flexDirection: {xs: "row", md: "column"},
            flexWrap: {xs: "wrap", md: "nowrap"},
            gap: 0.25,
        }}
    >
        {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/console"} className="nav-nudge" style={{textDecoration: "none"}}>
                {({isActive}) => (
                    <Box
                        component="span"
                        sx={{
                            position: "relative",
                            display: {xs: "inline-flex", md: "flex"},
                            alignItems: "center",
                            gap: 1,
                            minHeight: 40,
                            px: 1.5,
                            borderRadius: "8px",
                            fontSize: 14,
                            fontWeight: 500,
                            color: isActive ? colors.navy : colors.muted,
                            bgcolor: isActive ? alpha(colors.aqua, 0.45) : "transparent",
                            // The red marker on the active item, as in the mockup.
                            "&::before": isActive
                                ? {content: '""', position: "absolute", left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2, bgcolor: colors.red}
                                : undefined,
                        }}
                    >
                        {item.label}
                        {item.count !== undefined && <CountBadge count={item.count} active={isActive} />}
                    </Box>
                )}
            </NavLink>
        ))}
    </Box>
);
