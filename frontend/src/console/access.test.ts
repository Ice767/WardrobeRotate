import {describe, expect, it} from "vitest";

import type {PublicUser} from "../api/types";
import {consoleAccess} from "./access";

const user = (role: PublicUser["role"], carrierId?: string): PublicUser => ({
    userId: "u1",
    email: "a@b.dev",
    name: "A",
    role,
    ...(carrierId && {carrierId}),
});

describe("consoleAccess", () => {
    it("waits while the session check runs", () => {
        expect(consoleAccess(undefined, undefined, true)).toBe("loading");
    });

    it("sends to sign-in when the session is gone", () => {
        expect(consoleAccess(undefined, {status: 401}, false)).toBe("signin");
        expect(consoleAccess(undefined, undefined, false)).toBe("signin");
    });

    it("does not ask for a password when the backend is down", () => {
        expect(consoleAccess(undefined, {status: 502}, false)).toBe("unavailable");
        expect(consoleAccess(user("MANAGER", "c1"), {status: 502}, false)).toBe("ok");
    });

    it("keeps clients, admins and managers without a carrier out", () => {
        expect(consoleAccess(user("CLIENT"), undefined, false)).toBe("forbidden");
        expect(consoleAccess(user("ADMIN"), undefined, false)).toBe("forbidden");
        expect(consoleAccess(user("MANAGER"), undefined, false)).toBe("forbidden");
    });

    it("lets a manager of a carrier in", () => {
        expect(consoleAccess(user("MANAGER", "c1"), undefined, false)).toBe("ok");
    });
});
