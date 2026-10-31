import assert from "node:assert/strict";
import type {AddressInfo} from "node:net";
import type {Server} from "node:http";
import {after, before, describe, it} from "node:test";

import app from "../app";
import {registerUser} from "../services/auth.service";

describe("login rate limit", () => {
    let server: Server;
    let loginUrl: string;

    before(async () => {
        // Successful sign-ins issue a token; the secret is read when signing.
        process.env.JWT_ACCESS_SECRET ??= "test-secret";
        await registerUser({email: "owner@example.com", password: "right-password", name: "Owner"});
        server = app.listen(0);
        await new Promise((resolve) => server.once("listening", resolve));
        loginUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/auth/login`;
    });

    after(() => {
        server.close();
    });

    const login = (password: string) =>
        fetch(loginUrl, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({email: "owner@example.com", password}),
        });

    it("does not count successful sign-ins", async () => {
        for (let attempt = 0; attempt < 12; attempt += 1) {
            assert.equal((await login("right-password")).status, 200);
        }
    });

    it("refuses the eleventh failed attempt, even with the right password", async () => {
        for (let attempt = 0; attempt < 10; attempt += 1) {
            assert.equal((await login("wrong-password")).status, 401);
        }

        const blocked = await login("right-password");
        const envelope = (await blocked.json()) as {success: boolean};

        assert.equal(blocked.status, 429);
        assert.equal(envelope.success, false);
    });
});
