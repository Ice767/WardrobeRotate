import {createMemoryRepositories} from "./memory";
import {createPostgresRepositories} from "./postgres";
import type {Repositories} from "./types";

let current: Repositories | undefined;

/**
 * Postgres when DATABASE_URL is set, process memory otherwise. Chosen on first
 * use rather than at import, so dotenv has filled process.env by then.
 */
export const repos = (): Repositories => {
    current ??= process.env.DATABASE_URL
        ? createPostgresRepositories(process.env.DATABASE_URL)
        : createMemoryRepositories();

    return current;
};

/** Tests swap in their own storage. */
export const useRepositories = (repositories: Repositories): void => {
    current = repositories;
};

export {DuplicateError} from "./types";
export type {Repositories} from "./types";
