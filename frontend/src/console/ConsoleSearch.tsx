import {Box, Typography} from "@mui/material";
import {alpha} from "@mui/material/styles";
import {useEffect, useMemo, useRef, useState, type KeyboardEvent} from "react";
import {Link as RouterLink, useLocation, useNavigate, useSearchParams} from "react-router-dom";

import {Pill} from "../components/Pill";
import {colors} from "../theme";
import {KIND_TONE, searchConsole} from "./search";
import {useSearchData} from "./useSearchData";

const MAX_SHOWN = 6;

export const ConsoleSearch = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [params] = useSearchParams();
    const onSearchPage = location.pathname === "/console/search";
    const [query, setQuery] = useState(onSearchPage ? params.get("q") ?? "" : "");
    const [open, setOpen] = useState(false);
    const box = useRef<HTMLDivElement>(null);
    const data = useSearchData();

    const hits = useMemo(() => searchConsole(query, data), [query, data]);
    const trimmed = query.trim();

    // Any click outside the field and its list closes the list.
    useEffect(() => {
        const close = (event: MouseEvent) => {
            if (box.current && !box.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, []);

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Escape") {
            setOpen(false);
        }

        // With nothing found, Enter has nowhere to go.
        if (event.key === "Enter" && hits.length > 0) {
            setOpen(false);
            navigate(`/console/search?q=${encodeURIComponent(trimmed)}`);
        }
    };

    return (
        <Box ref={box} sx={{position: "relative", maxWidth: 520}}>
            <Box component="label" htmlFor="console-search" sx={{position: "absolute", left: -9999}}>
                Search the console
            </Box>
            <Box
                component="svg"
                aria-hidden="true"
                viewBox="0 0 24 24"
                sx={{position: "absolute", left: 11, top: 10, width: 16, height: 16, fill: "none", stroke: colors.muted, strokeWidth: 2, strokeLinecap: "round"}}
            >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
            </Box>
            <Box
                component="input"
                id="console-search"
                type="search"
                autoComplete="off"
                role="combobox"
                aria-expanded={open && trimmed !== ""}
                aria-controls="console-search-results"
                placeholder="Search tariffs, requests, tracking codes"
                value={query}
                onChange={(event) => {
                    setQuery(event.target.value);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={onKeyDown}
                sx={{
                    width: "100%",
                    boxSizing: "border-box",
                    height: 36,
                    pl: "34px",
                    pr: 1.5,
                    border: `1px solid ${colors.line}`,
                    borderRadius: "8px",
                    bgcolor: colors.surface,
                    color: colors.navy,
                    font: "inherit",
                    fontSize: 14,
                    outline: "none",
                    transition: "border-color 0.18s ease, box-shadow 0.18s ease",
                    "&:focus": {borderColor: "#9aa6b5", boxShadow: `0 0 0 3px ${alpha(colors.red, 0.18)}`},
                }}
            />

            {open && trimmed !== "" && (
                <Box
                    id="console-search-results"
                    className="enter"
                    sx={{
                        position: "absolute",
                        top: 42,
                        left: 0,
                        right: 0,
                        zIndex: 10,
                        bgcolor: colors.surface,
                        border: `1px solid ${colors.line}`,
                        borderRadius: "10px",
                        boxShadow: "0 12px 32px rgba(17, 24, 39, 0.14)",
                        overflow: "hidden",
                    }}
                >
                    {hits.length === 0 ? (
                        <Box sx={{p: 2}}>
                            <Typography sx={{fontWeight: 600}}>No results for “{trimmed}”</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Try a city, a tracking code like FM-…, a request id like RFQ-… or a mode like AIR.
                            </Typography>
                        </Box>
                    ) : (
                        <>
                            <Box component="ul" aria-label="Search results" sx={{listStyle: "none", m: 0, p: 0.5}}>
                                {hits.slice(0, MAX_SHOWN).map((hit, index) => (
                                    <li key={`${hit.kind}-${hit.id}`} className="stagger" style={{animationDelay: `${index * 40}ms`}}>
                                        <Box
                                            component={RouterLink}
                                            to={hit.to}
                                            onClick={() => setOpen(false)}
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1.25,
                                                px: 1.25,
                                                py: 1,
                                                borderRadius: "8px",
                                                color: colors.navy,
                                                textDecoration: "none",
                                                "&:hover, &:focus-visible": {bgcolor: alpha(colors.aqua, 0.28)},
                                            }}
                                        >
                                            <Pill tone={KIND_TONE[hit.kind]}>{hit.kind}</Pill>
                                            <Box sx={{minWidth: 0}}>
                                                <Typography sx={{fontWeight: 600, fontSize: 14}} noWrap>{hit.title}</Typography>
                                                <Typography variant="caption" color="text.secondary" noWrap component="div">{hit.sub}</Typography>
                                            </Box>
                                        </Box>
                                    </li>
                                ))}
                            </Box>
                            <Typography variant="caption" color="text.secondary" component="div" sx={{px: 2, py: 1, borderTop: `1px solid ${colors.line}`}}>
                                {hits.length === 1 ? "1 result" : `${hits.length} results`} · Enter to see all
                            </Typography>
                        </>
                    )}
                </Box>
            )}
        </Box>
    );
};
