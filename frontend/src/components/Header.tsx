import {Box, Button, Link, Typography} from "@mui/material";
import {Link as RouterLink, NavLink, useNavigate} from "react-router-dom";

import {useLogoutMutation, useMeQuery} from "../api/api";
import {colors, fonts} from "../theme";

const navStyle = ({isActive}: {isActive: boolean}) => ({
    color: isActive ? colors.surface : "#c3ced8",
    textDecoration: "none",
    borderBottom: isActive ? "2px solid #78b2e4" : "2px solid transparent",
    paddingBottom: 2,
    fontSize: 14,
});

export const Header = () => {
    const {data: me} = useMeQuery();
    const [logout] = useLogoutMutation();
    const navigate = useNavigate();

    const signOut = async () => {
        await logout();
        navigate("/");
    };

    return (
        <Box component="header" sx={{bgcolor: colors.ink, color: colors.ground}}>
            <Box
                sx={{
                    maxWidth: 1200,
                    mx: "auto",
                    px: {xs: 2, sm: 4},
                    py: 1.75,
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                }}
            >
                <Link component={RouterLink} to="/" underline="none" sx={{color: "inherit", display: "flex", alignItems: "baseline", gap: 1.5}}>
                    <Typography component="span" sx={{fontFamily: fonts.display, fontWeight: 700, fontSize: 26, letterSpacing: "0.02em"}}>
                        FREIGHT MARKET
                    </Typography>
                    <Typography component="span" variant="caption" sx={{color: "#9fb0bf", display: {xs: "none", sm: "inline"}}}>
                        US · IL · RU lanes
                    </Typography>
                </Link>

                <Box component="nav" sx={{display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2.5}}>
                    <NavLink to="/" end style={navStyle}>Get a quote</NavLink>
                    <NavLink to="/track" style={navStyle}>Track a shipment</NavLink>
                    {me ? (
                        <>
                            <NavLink to="/account" style={navStyle}>My shipments</NavLink>
                            <Button onClick={signOut} size="small" sx={{color: "#c3ced8", minHeight: 32, px: 1}}>
                                Sign out
                            </Button>
                        </>
                    ) : (
                        <NavLink to="/signin" style={navStyle}>Sign in</NavLink>
                    )}
                </Box>
            </Box>
        </Box>
    );
};
