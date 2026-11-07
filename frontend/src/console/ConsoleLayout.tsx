import {Alert, Box, Button, Paper, Typography} from "@mui/material";
import {Link as RouterLink, Navigate, Outlet, useLocation} from "react-router-dom";

import {errorText, useMeQuery, useRfqsQuery, useShipmentsQuery, useTariffsQuery} from "../api/api";
import {sessionUser} from "../lib/session";
import {colors} from "../theme";
import {consoleAccess} from "./access";
import {ConsoleNav} from "./ConsoleNav";
import {ConsoleSearch} from "./ConsoleSearch";
import {requestState} from "./requests";
import {ToastProvider} from "./toast";

const Centered = ({children}: {children: React.ReactNode}) => (
    <Box component="main" className="enter" sx={{maxWidth: 560, mx: "auto", px: 2, py: 6}}>
        {children}
    </Box>
);

export const ConsoleLayout = () => {
    const location = useLocation();
    const {data, error, isLoading, refetch} = useMeQuery();
    const me = sessionUser(data, error);
    const access = consoleAccess(me, error, isLoading);
    const ready = access === "ok";

    const {data: tariffs} = useTariffsQuery(undefined, {skip: !ready});
    const {data: rfqs} = useRfqsQuery(undefined, {skip: !ready});
    const {data: shipments} = useShipmentsQuery(undefined, {skip: !ready});

    if (access === "loading") {
        return null;
    }

    if (access === "signin") {
        return <Navigate to="/signin" state={{from: location.pathname + location.search}} replace />;
    }

    if (access === "unavailable") {
        return (
            <Centered>
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => refetch()}>Try again</Button>}>
                    {errorText(error)}
                </Alert>
            </Centered>
        );
    }

    if (access === "forbidden" || !me?.carrierId) {
        return (
            <Centered>
                <Paper sx={{p: 3, display: "flex", flexDirection: "column", gap: 1.5, alignItems: "flex-start"}}>
                    <Typography variant="h2" component="h1">This area is for carriers.</Typography>
                    <Typography color="text.secondary">
                        The console is where a carrier manages tariffs, answers quote requests and moves shipments along.
                    </Typography>
                    <Button component={RouterLink} to="/" variant="outlined">Back to quotes</Button>
                </Paper>
            </Centered>
        );
    }

    const carrierId = me.carrierId;
    const now = new Date();

    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: {xs: "1fr", md: "220px minmax(0, 1fr)"},
                // On a phone the menu sits on top and only the content stretches.
                gridTemplateRows: {xs: "auto 1fr", md: "1fr"},
                minHeight: "calc(100vh - 53px)",
            }}
        >
            <ConsoleNav
                items={[
                    {to: "/console", label: "Overview"},
                    {to: "/console/tariffs", label: "Tariffs", count: tariffs?.length},
                    {
                        to: "/console/requests",
                        label: "Quote requests",
                        count: rfqs?.filter((rfq) => requestState(rfq, carrierId, now) === "open").length,
                    },
                    {
                        to: "/console/shipments",
                        label: "Shipments",
                        count: shipments?.filter((s) => s.status !== "DELIVERED" && s.status !== "CANCELLED").length,
                    },
                ]}
            />
            <Box component="main" sx={{minWidth: 0, px: {xs: 2, sm: 4}, py: 3, bgcolor: colors.cream}}>
                <Box sx={{mb: 3}}>
                    <ConsoleSearch />
                </Box>
                <ToastProvider>
                    <Outlet />
                </ToastProvider>
            </Box>
        </Box>
    );
};
