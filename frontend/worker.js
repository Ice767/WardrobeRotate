// Cloudflare Worker in front of the site. Static files (the built React app in
// dist/) are served by Cloudflare's asset handling; only /api/* reaches this
// code (run_worker_first in wrangler.jsonc) and is forwarded to the backend on
// Render. The browser only ever talks to the site's own origin, so the auth
// cookie stays first-party and SameSite=Lax keeps working.
//
// API_ORIGIN and PROXY_SECRET are Worker secrets (wrangler secret put).

// Render's free plan puts the backend to sleep and answers 502/503 at once
// until it is up again, usually within a minute.
const WAKE_STATUSES = new Set([502, 503]);
const WAKE_ATTEMPTS = 12;
const WAKE_DELAY_MS = 5_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const forwardToApi = (request, env) => {
    const incoming = new URL(request.url);
    const target = new URL(incoming.pathname + incoming.search, env.API_ORIGIN);

    const headers = new Headers(request.headers);
    // The backend rate-limits sign-in per client address. Without this it would
    // see Cloudflare's address for everyone. Overwritten, not appended, so a
    // client cannot slip in a forged address of its own.
    headers.set("X-Forwarded-For", request.headers.get("CF-Connecting-IP") ?? "");
    headers.delete("Host");
    // Proves to the backend that the request came through here (PROXY_SECRET,
    // the same value on both sides).
    headers.set("X-Proxy-Secret", env.PROXY_SECRET ?? "");

    return fetch(target, {
        method: request.method,
        headers,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
        // Redirects go back to the browser as they are, so Location is not followed here.
        redirect: "manual",
    });
};

// Only reads are repeated: the backend might have done a POST before failing,
// and sending it twice could book a shipment twice.
const forwardWaitingForWake = async (request, env) => {
    let response = await forwardToApi(request, env);

    if (request.method !== "GET" && request.method !== "HEAD") {
        return response;
    }

    for (let attempt = 1; attempt < WAKE_ATTEMPTS && WAKE_STATUSES.has(response.status); attempt += 1) {
        await response.body?.cancel();
        await sleep(WAKE_DELAY_MS);
        response = await forwardToApi(request, env);
    }

    return response;
};

export default {
    async fetch(request, env) {
        if (new URL(request.url).pathname.startsWith("/api/")) {
            if (!env.API_ORIGIN) {
                return new Response("API_ORIGIN is not configured", {status: 500});
            }

            return forwardWaitingForWake(request, env);
        }

        return env.ASSETS.fetch(request);
    },

    // Runs on the cron in wrangler.jsonc. Render sleeps after 15 idle minutes,
    // so a ping every 10 keeps the first visitor from waiting.
    scheduled(_event, env, ctx) {
        ctx.waitUntil(fetch(new URL("/api/health", env.API_ORIGIN)));
    },
};
