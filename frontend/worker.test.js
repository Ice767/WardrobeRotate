import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import worker from "./worker.js";

const env = {API_ORIGIN: "https://api.example.com", PROXY_SECRET: "secret"};

const request = (method = "GET") =>
    new Request("https://site.example.com/api/regions", {method, body: method === "POST" ? "{}" : undefined});

describe("worker", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("waits for a sleeping backend on a GET", async () => {
        const upstream = vi.fn()
            .mockResolvedValueOnce(new Response("waking", {status: 502}))
            .mockResolvedValueOnce(new Response("waking", {status: 503}))
            .mockResolvedValueOnce(new Response("ok", {status: 200}));
        vi.stubGlobal("fetch", upstream);

        const pending = worker.fetch(request(), env);
        await vi.runAllTimersAsync();

        expect((await pending).status).toBe(200);
        expect(upstream).toHaveBeenCalledTimes(3);
    });

    it("gives up after about a minute and passes the failure on", async () => {
        const upstream = vi.fn().mockImplementation(async () => new Response("down", {status: 502}));
        vi.stubGlobal("fetch", upstream);

        const pending = worker.fetch(request(), env);
        await vi.runAllTimersAsync();

        expect((await pending).status).toBe(502);
        expect(upstream.mock.calls.length).toBeLessThanOrEqual(13);
    });

    it("never repeats a POST", async () => {
        const upstream = vi.fn().mockResolvedValue(new Response("down", {status: 502}));
        vi.stubGlobal("fetch", upstream);

        const response = await worker.fetch(request("POST"), env);

        expect(response.status).toBe(502);
        expect(upstream).toHaveBeenCalledTimes(1);
    });

    it("does not repeat an answer from the backend itself", async () => {
        const upstream = vi.fn().mockResolvedValue(new Response("nope", {status: 404}));
        vi.stubGlobal("fetch", upstream);

        expect((await worker.fetch(request(), env)).status).toBe(404);
        expect(upstream).toHaveBeenCalledTimes(1);
    });

    it("pings the health check on the schedule", async () => {
        const upstream = vi.fn().mockResolvedValue(new Response("ok"));
        vi.stubGlobal("fetch", upstream);
        const waits = [];

        worker.scheduled({}, env, {waitUntil: (promise) => waits.push(promise)});
        await Promise.all(waits);

        expect(String(upstream.mock.calls[0][0])).toBe("https://api.example.com/api/health");
    });
});
