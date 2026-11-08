import {Box} from "@mui/material";
import {Route, Routes} from "react-router-dom";

import {Header} from "./components/Header";
import {ConsoleLayout} from "./console/ConsoleLayout";
import {OverviewPage} from "./console/OverviewPage";
import {RequestsPage} from "./console/RequestsPage";
import {SearchPage} from "./console/SearchPage";
import {ShipmentsPage} from "./console/ShipmentsPage";
import {TariffsPage} from "./console/TariffsPage";
import {AccountPage} from "./pages/AccountPage";
import {QuotePage} from "./pages/QuotePage";
import {SignInPage} from "./pages/SignInPage";
import {TrackingPage} from "./pages/TrackingPage";

export const App = () => (
    <Box sx={{minHeight: "100vh", bgcolor: "background.default"}}>
        <Header />
        <Routes>
            <Route path="/" element={<QuotePage />} />
            <Route path="/track" element={<TrackingPage />} />
            <Route path="/track/:code" element={<TrackingPage />} />
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/console" element={<ConsoleLayout />}>
                <Route index element={<OverviewPage />} />
                <Route path="tariffs" element={<TariffsPage />} />
                <Route path="requests" element={<RequestsPage />} />
                <Route path="shipments" element={<ShipmentsPage />} />
                <Route path="search" element={<SearchPage />} />
            </Route>
            <Route path="*" element={<QuotePage />} />
        </Routes>
    </Box>
);
