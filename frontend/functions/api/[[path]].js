// Cloudflare Pages Function: every /api/* request on the site is forwarded to
// the backend on Render. The browser only ever talks to the site's own origin,
// so the auth cookie stays first-party and SameSite=Lax keeps working.
//
// API_ORIGIN is set in the Pages project settings, e.g. https://freight-api.onrender.com

export const onRequest = async ({request, env}) => {
    if (!env.API_ORIGIN) {
        return new Response("API_ORIGIN is not configured", {status: 500});
    }

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
