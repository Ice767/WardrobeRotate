import type {SignOptions} from "jsonwebtoken";

const getRequiredEnv = (name: string): string => {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
};

export const jwtConfig = {
    // A getter rather than a field: the value is read at use time, after dotenv
    // has populated process.env, and fails loudly when the secret is missing.
    get accessSecret(): string {
        return getRequiredEnv("JWT_ACCESS_SECRET");
    },

    accessTtl: (process.env.JWT_ACCESS_TTL ?? "1d") as SignOptions["expiresIn"],
};
