import jwt from "jsonwebtoken";

import {jwtConfig} from "../config/jwt.config";
import type {UserRole} from "../contracts/auth.contract";

export interface TokenInput {
    sub: string;
    role: UserRole;
    carrierId?: string;
}

export interface TokenPayload extends TokenInput {
    type: "access";
}

// Named on both sides rather than inferred from the token header: the header
// is attacker-controlled, and verify should accept exactly what sign produces.
const ALGORITHM = "HS256";

export function signAccessToken(payload: TokenInput): string {
    return jwt.sign({...payload, type: "access"}, jwtConfig.accessSecret, {
        algorithm: ALGORITHM,
        expiresIn: jwtConfig.accessTtl,
    });
}

export function verifyAccessToken(token: string): TokenPayload {
    const payload = jwt.verify(token, jwtConfig.accessSecret, {algorithms: [ALGORITHM]});

    // A token signed with the same secret for another purpose must not open a
    // session. Callers already treat any throw as "invalid token".
    if (typeof payload === "string" || payload.type !== "access") {
        throw new jwt.JsonWebTokenError("Not an access token");
    }

    return payload as TokenPayload;
}
