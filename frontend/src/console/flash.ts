import {useCallback, useEffect, useRef, useState} from "react";
import {useSearchParams} from "react-router-dom";

const FLASH_MS = 1600;

/** The DOM id of a console row, so a search result can scroll to it. */
export const rowId = (id: string) => `row-${id}`;

/**
 * Which row of a section shows the short aqua flash: the one a search result
 * pointed at (`?focus=<id>`, once its row exists), or one just changed.
 */
export const useFlashRow = (loadedIds: string[]) => {
    const [params] = useSearchParams();
    const focus = params.get("focus");
    const [flashId, setFlashId] = useState<string | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const handledFocus = useRef<string | null>(null);

    const flash = useCallback((id: string) => {
        clearTimeout(timer.current);
        setFlashId(id);
        timer.current = setTimeout(() => setFlashId(null), FLASH_MS);
    }, []);

    const focusLoaded = focus !== null && loadedIds.includes(focus);

    useEffect(() => {
        if (!focus || !focusLoaded || handledFocus.current === focus) {
            return;
        }

        handledFocus.current = focus;
        document.getElementById(rowId(focus))?.scrollIntoView({block: "center", behavior: "smooth"});
        flash(focus);
    }, [focus, focusLoaded, flash]);

    useEffect(() => () => clearTimeout(timer.current), []);

    return {flashId, flash};
};
