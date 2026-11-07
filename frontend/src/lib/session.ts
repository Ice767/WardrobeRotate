import type {PublicUser} from "../api/types";

/**
 * RTK Query keeps the last user in the cache when a refetch fails, so after a
 * sign-out or an expired session the stale user is still there. Only a 401 means
 * nobody is signed in: any other failure, like a sleeping backend, says nothing
 * about the session.
 */
export const sessionUser = (user: PublicUser | undefined, error: unknown): PublicUser | undefined =>
    (error as {status?: unknown} | undefined)?.status === 401 ? undefined : user;
