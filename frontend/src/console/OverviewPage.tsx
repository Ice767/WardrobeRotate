import {Box, Paper, Typography} from "@mui/material";
import {alpha} from "@mui/material/styles";
import {Link as RouterLink} from "react-router-dom";

import {useCurrentUser, useRegionsQuery, useRfqsQuery, useShipmentsQuery, useTariffsQuery} from "../api/api";
import {Pill} from "../components/Pill";
import {formatCents} from "../lib/format";
import {colors, fonts} from "../theme";
import {requestState} from "./requests";
import {shortRfqId} from "./search";
import {consoleStats} from "./stats";

const CHART_HEIGHT = 56;

/** Seven weekly bars; the current week is red, the rest aqua. */
const WeeklyBars = ({weeks}: {weeks: number[]}) => {
    const max = Math.max(...weeks, 1);

    return (
        <Box
            role="img"
            aria-label={`Bookings per week, oldest first: ${weeks.map((cents) => formatCents(cents)).join(", ")}`}
            sx={{display: "flex", alignItems: "flex-end", gap: 0.75, height: CHART_HEIGHT, mt: 1.5}}
        >
            {weeks.map((cents, index) => (
                <Box
                    key={index}
                    className="bar-grow"
                    style={{animationDelay: `${index * 60}ms`}}
                    sx={{
                        flex: 1,
                        // A thin base even for an empty week, so the chart never looks broken.
                        height: Math.max(3, Math.round((cents / max) * CHART_HEIGHT)),
                        borderRadius: "3px 3px 0 0",
                        bgcolor: index === weeks.length - 1 ? colors.red : colors.aqua,
                    }}
                />
            ))}
        </Box>
    );
};

const StatCard = ({label, value, index, children}: {label: string; value: string; index: number; children?: React.ReactNode}) => (
    <Paper className="stagger card-hover" style={{animationDelay: `${index * 60}ms`}} sx={{p: 2.25, display: "flex", flexDirection: "column"}}>
        <Typography variant="overline" color="text.secondary">{label}</Typography>
        <Typography sx={{fontFamily: fonts.mono, fontWeight: 500, fontSize: 28, lineHeight: 1.15}}>{value}</Typography>
        {children}
    </Paper>
);

export const OverviewPage = () => {
    const me = useCurrentUser();
    const {data: tariffs = []} = useTariffsQuery();
    const {data: rfqs = []} = useRfqsQuery();
    const {data: shipments = []} = useShipmentsQuery();
    const {data: regions = []} = useRegionsQuery();

    const carrierId = me?.carrierId ?? "";
    const now = new Date();
    const stats = consoleStats({carrierId, tariffs, rfqs, shipments, now});
    const toAnswer = rfqs.filter((rfq) => requestState(rfq, carrierId, now) === "open");
    const name = (id: string) => regions.find((region) => region.regionId === id)?.name ?? "…";

    return (
        <Box className="enter" sx={{display: "flex", flexDirection: "column", gap: 3}}>
            <Typography variant="h1">Overview</Typography>

            <Box sx={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 2}}>
                <StatCard index={0} label="Active tariffs" value={String(stats.activeTariffs)} />
                <StatCard index={1} label="Requests to answer" value={String(stats.requestsToAnswer)} />
                <StatCard index={2} label="Shipments in progress" value={String(stats.inProgress)} />
                <StatCard index={3} label="Booked this month" value={formatCents(stats.bookedThisMonthCents)}>
                    <WeeklyBars weeks={stats.weeklyBookingsCents} />
                    <Typography variant="caption" color="text.secondary">Last 7 weeks, this week in red</Typography>
                </StatCard>
            </Box>

            <Box component="section" aria-label="Needs your answer" sx={{display: "flex", flexDirection: "column", gap: 1}}>
                <Typography variant="h2">Needs your answer</Typography>
                {toAnswer.length === 0 ? (
                    <Paper sx={{p: 2.5, borderStyle: "dashed"}}>
                        <Typography color="text.secondary">All requests answered.</Typography>
                    </Paper>
                ) : (
                    <Paper component="ul" sx={{listStyle: "none", m: 0, p: 0, overflow: "hidden"}}>
                        {toAnswer.map((rfq, index) => (
                            <Box
                                component="li"
                                key={rfq.rfqId}
                                className="stagger"
                                style={{animationDelay: `${index * 60}ms`}}
                                sx={{borderTop: index === 0 ? "none" : `1px solid ${colors.line}`}}
                            >
                                <Box
                                    component={RouterLink}
                                    to={`/console/requests?focus=${rfq.rfqId}`}
                                    sx={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        alignItems: "center",
                                        gap: 1.5,
                                        px: 2,
                                        py: 1.25,
                                        color: colors.navy,
                                        textDecoration: "none",
                                        transition: "background-color 0.15s ease",
                                        "&:hover": {bgcolor: alpha(colors.aqua, 0.18)},
                                    }}
                                >
                                    <Typography sx={{fontFamily: fonts.mono, fontWeight: 500}}>{shortRfqId(rfq.rfqId)}</Typography>
                                    <Pill tone="alert">{rfq.cargoCategory.replace("_", " ").toLowerCase()}</Pill>
                                    <Typography sx={{flex: 1, minWidth: 160}}>
                                        {name(rfq.fromRegionId)} → {name(rfq.toRegionId)}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Expires {new Date(rfq.expiresAt).toLocaleDateString("en-GB")}
                                    </Typography>
                                    <Box component="span" sx={{color: colors.red, fontWeight: 600, fontSize: 14}}>Answer →</Box>
                                </Box>
                            </Box>
                        ))}
                    </Paper>
                )}
            </Box>
        </Box>
    );
};
