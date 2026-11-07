import type {PublicUser} from "../api/types";

export type ConsoleAccess = "loading" | "signin" | "unavailable" | "forbidden" | "ok";

/**
 * Who may see the console. `me` is the user after `sessionUser`, so a 401 has
 * already cleared it. A failure other than 401 with no user at all means the
 * backend could not be asked: that is "unavailable", not a reason to ask for
 * the password again.
 */
export const consoleAccess = (me: PublicUser | undefined, error: unknown, isLoading: boolean): ConsoleAccess => {
    if (isLoading) {
        return "loading";
    }

    if (!me) {
        const status = (error as {status?: unknown} | undefined)?.status;
        return error && status !== 401 ? "unavailable" : "signin";
    }

    return me.role === "MANAGER" && me.carrierId ? "ok" : "forbidden";
};
