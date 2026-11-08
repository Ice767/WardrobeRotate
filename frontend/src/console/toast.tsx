import {Box} from "@mui/material";
import {createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode} from "react";

import {colors} from "../theme";

const TOAST_MS = 2600;

const ToastContext = createContext<(message: string) => void>(() => {});

/** Shows a short confirmation in the bottom-right corner of the console. */
export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({children}: {children: ReactNode}) => {
    const [toast, setToast] = useState<{id: number; message: string} | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

    const show = useCallback((message: string) => {
        clearTimeout(timer.current);
        setToast({id: Date.now(), message});
        // A timer, not animationend: with reduced motion there is no animation to end.
        timer.current = setTimeout(() => setToast(null), TOAST_MS);
    }, []);

    useEffect(() => () => clearTimeout(timer.current), []);

    return (
        <ToastContext.Provider value={show}>
            {children}
            <Box role="status" aria-live="polite" sx={{position: "fixed", right: 20, bottom: 20, zIndex: 1400, pointerEvents: "none"}}>
                {toast && (
                    <Box
                        key={toast.id}
                        className="toast-in"
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.25,
                            px: 2,
                            py: 1.25,
                            borderRadius: "10px",
                            bgcolor: colors.navy,
                            color: colors.surface,
                            fontSize: 14,
                            fontWeight: 500,
                            boxShadow: "0 12px 32px rgba(17, 24, 39, 0.24)",
                        }}
                    >
                        <Box component="span" aria-hidden="true" sx={{color: colors.aqua, fontWeight: 700}}>✓</Box>
                        {toast.message}
                    </Box>
                )}
            </Box>
        </ToastContext.Provider>
    );
};
