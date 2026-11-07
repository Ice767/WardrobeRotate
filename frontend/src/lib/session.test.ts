import {describe, expect, it} from "vitest";

import type {PublicUser} from "../api/types";
import {sessionUser} from "./session";

const user: PublicUser = {userId: "u1", email: "a@b.dev", name: "A", role: "CLIENT"};

describe("sessionUser", () => {
    it("returns the user when the last check succeeded", () => {
        expect(sessionUser(user, undefined)).toBe(user);
    });

    it("drops the cached user when the backend answers 401", () => {
        expect(sessionUser(user, {status: 401, data: null})).toBeUndefined();
    });

    it("keeps the cached user when the backend is unreachable", () => {
        expect(sessionUser(user, {status: 502, data: null})).toBe(user);
        expect(sessionUser(user, {status: "FETCH_ERROR", error: "offline"})).toBe(user);
    });

    it("returns nothing before the first check finishes", () => {
        expect(sessionUser(undefined, undefined)).toBeUndefined();
    });
});
