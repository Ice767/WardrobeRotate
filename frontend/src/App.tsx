import {Box} from "@mui/material";
import {Route, Routes} from "react-router-dom";

import {Header} from "./components/Header";
import {ConsoleLayout} from "./console/ConsoleLayout";
import {ConsolePlaceholder} from "./console/ConsolePlaceholder";
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
                <Route index element={<ConsolePlaceholder title="Overview" />} />
                <Route path="tariffs" element={<ConsolePlaceholder title="Tariffs" />} />
                <Route path="requests" element={<ConsolePlaceholder title="Quote requests" />} />
                <Route path="shipments" element={<ConsolePlaceholder title="Shipments" />} />
                <Route path="search" element={<ConsolePlaceholder title="Search" />} />
            </Route>
            <Route path="*" element={<QuotePage />} />
        </Routes>
    </Box>
);
