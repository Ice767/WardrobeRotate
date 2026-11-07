import {Box, Paper, Typography} from "@mui/material";

/** Stands in for a console section until its own step builds it. */
export const ConsolePlaceholder = ({title}: {title: string}) => (
    <Box className="enter" sx={{display: "flex", flexDirection: "column", gap: 2}}>
        <Typography variant="h1">{title}</Typography>
        <Paper sx={{p: 3, borderStyle: "dashed"}}>
            <Typography color="text.secondary">This section is being built.</Typography>
        </Paper>
    </Box>
);
