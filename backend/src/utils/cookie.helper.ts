import type {CookieOptions, Response} from "express";
import jwt from "jsonwebtoken";

const isProduction = process.env.NODE_ENV === "production";

const authCookieOptions: CookieOptions = {
    // Page scripts cannot read this cookie — guards against token theft via XSS.
    httpOnly: true,
    // Never send over plain HTTP. Off in dev, otherwise localhost breaks.
    secure: isProduction,
    // lax in dev (front and back share localhost through a proxy),
    // none in production, where the domains differ.
    sameSite: isProduction ? "none" : "lax",
    path: "/",
};

// Cookie lifetime comes from the token itself rather than a constant: otherwise
// changing JWT_ACCESS_TTL would make cookie and token expire at different times.
const maxAgeFromToken = (token: string): number => {
    const decoded = jwt.decode(token) as {exp: number};

    return decoded.exp * 1000 - Date.now();
};

export const setAuthCookie = (res: Response, accessToken: string): void => {
    res.cookie("accessToken", accessToken, {
        ...authCookieOptions,
        maxAge: maxAgeFromToken(accessToken),
    });
};

// A browser drops the cookie only when the options match those used to set it
// (expires/maxAge aside), which is why the same object is reused here.
export const clearAuthCookie = (res: Response): void => {
    res.clearCookie("accessToken", authCookieOptions);
};
