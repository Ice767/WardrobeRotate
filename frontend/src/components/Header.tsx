import {Box, Button, Link, Typography} from "@mui/material";
import {Link as RouterLink, NavLink, useNavigate} from "react-router-dom";

import {useCurrentUser, useLogoutMutation} from "../api/api";
import {colors} from "../theme";

const navStyle = ({isActive}: {isActive: boolean}) => ({
    color: isActive ? colors.navy : colors.muted,
    fontWeight: isActive ? 600 : 500,
    textDecoration: "none",
    borderBottom: isActive ? `2px solid ${colors.red}` : "2px solid transparent",
    borderRadius: 4,
    padding: "2px 6px",
    fontSize: 14,
});

export const Header = () => {
    const me = useCurrentUser();
    const [logout] = useLogoutMutation();
    const navigate = useNavigate();

    const signOut = async () => {
        await logout();
        navigate("/");
    };

    return (
        <Box component="header" sx={{bgcolor: colors.surface, color: colors.navy, borderBottom: `1px solid ${colors.line}`}}>
            <Box
                sx={{
                    maxWidth: 1200,
                    mx: "auto",
                    px: {xs: 2, sm: 4},
                    py: 1.25,
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                }}
            >
                <Link component={RouterLink} to="/" underline="none" sx={{color: "inherit", display: "flex", alignItems: "center", gap: 1.25}}>
                    <Box
                        component="span"
                        aria-hidden="true"
                        className="logo-breathe"
                        sx={{
                            width: 28,
                            height: 28,
                            borderRadius: "7px",
                            bgcolor: colors.red,
                            color: colors.surface,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                        }}
                    >
                        C
                    </Box>
                    <Typography component="span" sx={{fontWeight: 700, fontSize: 17}}>
                        Cargoa
                    </Typography>
                </Link>

                <Box component="nav" sx={{display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5}}>
                    <NavLink to="/" end className="nav-nudge" style={navStyle}>Get a quote</NavLink>
                    <NavLink to="/track" className="nav-nudge" style={navStyle}>Track a shipment</NavLink>
                    {me ? (
                        <>
                            {me.role === "MANAGER" ? (
                                <NavLink to="/console" className="nav-nudge" style={navStyle}>Console</NavLink>
                            ) : (
                                <NavLink to="/account" className="nav-nudge" style={navStyle}>My shipments</NavLink>
                            )}
                            <Button onClick={signOut} size="small" color="inherit" sx={{color: colors.muted, minHeight: 32, px: 1}}>
                                Sign out
                            </Button>
                        </>
                    ) : (
                        <NavLink to="/signin" className="nav-nudge" style={navStyle}>Sign in</NavLink>
                    )}
                </Box>
            </Box>
        </Box>
    );
};
