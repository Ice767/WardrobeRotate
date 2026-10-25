import {Alert, Box, Button, Paper, Tab, Tabs, TextField, Typography} from "@mui/material";
import {useState, type FormEvent} from "react";
import {useLocation, useNavigate} from "react-router-dom";

import {errorText, useLoginMutation, useRegisterMutation} from "../api/api";

export const SignInPage = () => {
    const [mode, setMode] = useState<"signin" | "register">("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [company, setCompany] = useState("");
    const [login, loginState] = useLoginMutation();
    const [register, registerState] = useRegisterMutation();
    const navigate = useNavigate();
    const location = useLocation();
    const returnTo = (location.state as {from?: string} | null)?.from ?? "/";

    const state = mode === "signin" ? loginState : registerState;

    const submit = async (event: FormEvent) => {
        event.preventDefault();

        const result =
            mode === "signin"
                ? await login({email, password})
                : await register({email, password, name, ...(company.trim() && {companyName: company.trim()})});

        if (!("error" in result)) {
            navigate(returnTo);
        }
    };

    return (
        <Box component="main" sx={{maxWidth: 440, mx: "auto", px: 2, py: 5}}>
            <Paper component="form" onSubmit={submit} sx={{p: 3, display: "flex", flexDirection: "column", gap: 2}}>
                <Typography variant="h2" component="h1">{mode === "signin" ? "Sign in" : "Create an account"}</Typography>
                <Tabs value={mode} onChange={(_e, value) => setMode(value)} aria-label="Sign in or create an account">
                    <Tab value="signin" label="Sign in" />
                    <Tab value="register" label="Create account" />
                </Tabs>

                {mode === "register" && (
                    <>
                        <TextField id="name" label="Your name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
                        <TextField id="company" label="Company (optional)" value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" />
                    </>
                )}
                <TextField id="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                <TextField
                    id="password"
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    helperText={mode === "register" ? "At least 8 characters." : undefined}
                />

                {state.error && <Alert severity="error">{errorText(state.error)}</Alert>}

                <Button type="submit" variant="contained" size="large" disabled={state.isLoading}>
                    {mode === "signin" ? "Sign in" : "Create account"}
                </Button>
                <Typography variant="body2" color="text.secondary">
                    Carrier accounts are created by the platform team, not here.
                </Typography>
            </Paper>
        </Box>
    );
};
