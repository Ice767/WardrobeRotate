import assert from "node:assert/strict";
import {describe, it} from "node:test";

import type {NextFunction, Request, Response} from "express";

import {ForbiddenError} from "../errors/app.error";
import {requireProxySecret} from "./proxy.middleware";

const run = (secret: string | undefined, header?: string): unknown => {
    let passed: unknown = "not called";
    const req = {get: (name: string) => (name === "X-Proxy-Secret" ? header : undefined)} as Request;

    requireProxySecret(secret)(req, {} as Response, ((error?: unknown) => {
        passed = error;
    }) as NextFunction);

    return passed;
};

describe("requireProxySecret", () => {
    it("lets everything through when no secret is configured", () => {
        assert.equal(run(undefined), undefined);
    });

    it("lets a request with the right secret through", () => {
        assert.equal(run("s3cret", "s3cret"), undefined);
    });

    it("refuses a missing or wrong secret", () => {
        assert.ok(run("s3cret") instanceof ForbiddenError);
        assert.ok(run("s3cret", "guess") instanceof ForbiddenError);
    });
});
