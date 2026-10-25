import {Box} from "@mui/material";
import {Route, Routes} from "react-router-dom";

import {Header} from "./components/Header";
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
            <Route path="*" element={<QuotePage />} />
        </Routes>
    </Box>
);
