import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {ConflictError} from "../errors/app.error";
import {repos} from "../repositories";
import {loginUser, registerUser} from "./auth.service";

describe("registerUser", () => {
    it("lets only one of several concurrent sign-ups for an email through", async () => {
        const email = "race@example.com";
        const attempts = await Promise.allSettled(
            [1, 2, 3, 4, 5].map((n) =>
                registerUser({email, password: `password-${n}`, name: `User ${n}`}),
            ),
        );

        const created = attempts.filter((attempt) => attempt.status === "fulfilled");
        const refused = attempts.filter((attempt) => attempt.status === "rejected");

        assert.equal(created.length, 1);
        assert.ok(refused.every((attempt) => attempt.reason instanceof ConflictError));
        assert.equal((await repos().users.findByEmail(email))?.userId, (created[0] as PromiseFulfilledResult<{userId: string}>).value.userId);

        // The account that was stored is the one its owner can sign in to.
        const winner = (created[0] as PromiseFulfilledResult<{userId: string; name: string}>).value;
        const password = `password-${winner.name.slice("User ".length)}`;
        assert.equal((await loginUser({email, password})).userId, winner.userId);
    });

    it("treats emails that differ only in case and spacing as the same", async () => {
        await registerUser({email: "case@example.com", password: "password-1", name: "First"});

        await assert.rejects(
            registerUser({email: "  Case@Example.COM ", password: "password-2", name: "Second"}),
            ConflictError,
        );
    });
});
