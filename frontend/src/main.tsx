import {CssBaseline, StyledEngineProvider, ThemeProvider} from "@mui/material";
import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {Provider} from "react-redux";
import {BrowserRouter} from "react-router-dom";

import {App} from "./App";
import "./motion.css";
import {store} from "./store";
import {theme} from "./theme";

// injectFirst puts MUI's styles before motion.css, so the motion classes can
// replace the transitions MUI sets on its own components.
createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <Provider store={store}>
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={theme}>
                    <CssBaseline />
                    <BrowserRouter>
                        <App />
                    </BrowserRouter>
                </ThemeProvider>
            </StyledEngineProvider>
        </Provider>
    </StrictMode>,
);
