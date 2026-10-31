import assert from "node:assert/strict";
import {before, describe, it} from "node:test";

import jwt from "jsonwebtoken";

import {signAccessToken, verifyAccessToken} from "./token.service";

const SECRET = "test-secret";

describe("verifyAccessToken", () => {
    before(() => {
        process.env.JWT_ACCESS_SECRET = SECRET;
    });

    it("accepts what signAccessToken issues", () => {
        const payload = verifyAccessToken(signAccessToken({sub: "user-1", role: "CLIENT"}));

        assert.equal(payload.sub, "user-1");
        assert.equal(payload.type, "access");
    });

    it("rejects a token without the access type, even with a valid signature", () => {
        const other = jwt.sign({sub: "user-1", role: "ADMIN", type: "reset"}, SECRET);

        assert.throws(() => verifyAccessToken(other), jwt.JsonWebTokenError);
    });

    it("rejects a token signed with another HMAC algorithm", () => {
        const hs512 = jwt.sign({sub: "user-1", role: "ADMIN", type: "access"}, SECRET, {algorithm: "HS512"});

        assert.throws(() => verifyAccessToken(hs512), jwt.JsonWebTokenError);
    });
});
