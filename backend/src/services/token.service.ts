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

export function signAccessToken(payload: TokenInput): string {
    return jwt.sign({...payload, type: "access"}, jwtConfig.accessSecret, {
        expiresIn: jwtConfig.accessTtl,
    });
}

export function verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, jwtConfig.accessSecret) as TokenPayload;
}
