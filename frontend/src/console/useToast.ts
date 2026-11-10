import {createContext, useContext} from "react";

export const ToastContext = createContext<(message: string) => void>(() => {});

/** Shows a short confirmation in the bottom-right corner of the console. */
export const useToast = () => useContext(ToastContext);
