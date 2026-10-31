import assert from "node:assert/strict";
import type {AddressInfo} from "node:net";
import type {Server} from "node:http";
import {after, before, describe, it} from "node:test";

import app from "../app";

// Through the real app: the errors under test come from express.json(), which
// runs before any route, so only a real request produces them.
describe("errorHandler with request bodies the parser rejects", () => {
    let server: Server;
    let loginUrl: string;

    before(async () => {
        server = app.listen(0);
        await new Promise((resolve) => server.once("listening", resolve));
        loginUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/auth/login`;
    });

    after(() => {
        server.close();
    });

    const post = (body: string) =>
        fetch(loginUrl, {method: "POST", headers: {"Content-Type": "application/json"}, body});

    it("answers malformed JSON with 400, not 500", async () => {
        const response = await post("{bad");
        const envelope = (await response.json()) as {meta: {errorMessage: string}};

        assert.equal(response.status, 400);
        assert.equal(envelope.meta.errorMessage, "Request body is not valid JSON");
    });

    it("answers an oversize body with 413", async () => {
        const response = await post(JSON.stringify({padding: "x".repeat(200_000)}));

        assert.equal(response.status, 413);
    });
});
