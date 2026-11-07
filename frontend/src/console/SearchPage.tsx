import {Box, Paper, Typography} from "@mui/material";
import {alpha} from "@mui/material/styles";
import {useMemo} from "react";
import {Link as RouterLink, useSearchParams} from "react-router-dom";

import {Pill} from "../components/Pill";
import {colors} from "../theme";
import {KIND_TONE} from "./ConsoleSearch";
import {searchConsole, type SearchKind} from "./search";
import {useSearchData} from "./useSearchData";

const GROUPS: Array<{kind: SearchKind; title: string}> = [
    {kind: "Tariff", title: "Tariffs"},
    {kind: "Request", title: "Quote requests"},
    {kind: "Shipment", title: "Shipments"},
];

export const SearchPage = () => {
    const [params] = useSearchParams();
    const query = params.get("q") ?? "";
    const data = useSearchData();
    const hits = useMemo(() => searchConsole(query, data), [query, data]);

    return (
        <Box className="enter" sx={{display: "flex", flexDirection: "column", gap: 2.5}}>
            <Box>
                <Typography variant="h1">Search</Typography>
                <Typography color="text.secondary">
                    {hits.length === 1 ? "1 result" : `${hits.length} results`} for “{query.trim()}”
                </Typography>
            </Box>

            {hits.length === 0 && (
                <Paper sx={{p: 3, borderStyle: "dashed"}}>
                    <Typography color="text.secondary">Nothing matches. Try a city, a tracking code, a request id or a mode.</Typography>
                </Paper>
            )}

            {GROUPS.map(({kind, title}) => {
                const group = hits.filter((hit) => hit.kind === kind);

                if (group.length === 0) {
                    return null;
                }

                return (
                    <Box component="section" key={kind} aria-label={title} sx={{display: "flex", flexDirection: "column", gap: 1}}>
                        <Typography variant="h2">
                            {title} <Box component="span" sx={{color: colors.muted, fontWeight: 500}}>{group.length}</Box>
                        </Typography>
                        <Paper component="ul" sx={{listStyle: "none", m: 0, p: 0, overflow: "hidden"}}>
                            {group.map((hit, index) => (
                                <Box
                                    component="li"
                                    key={hit.id}
                                    className="stagger"
                                    style={{animationDelay: `${index * 60}ms`}}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1.5,
                                        px: 2,
                                        py: 1.25,
                                        borderTop: index === 0 ? "none" : `1px solid ${colors.line}`,
                                        transition: "background-color 0.15s ease",
                                        "&:hover": {bgcolor: alpha(colors.aqua, 0.18)},
                                    }}
                                >
                                    <Pill tone={KIND_TONE[hit.kind]}>{hit.kind}</Pill>
                                    <Box sx={{minWidth: 0, flex: 1}}>
                                        <Typography sx={{fontWeight: 600}} noWrap>{hit.title}</Typography>
                                        <Typography variant="body2" color="text.secondary" noWrap>{hit.sub}</Typography>
                                    </Box>
                                    <Box component={RouterLink} to={hit.to} sx={{color: colors.red, fontWeight: 600, fontSize: 14, textDecoration: "none", whiteSpace: "nowrap"}}>
                                        Open →
                                    </Box>
                                </Box>
                            ))}
                        </Paper>
                    </Box>
                );
            })}
        </Box>
    );
};
