import type {CorsOptions} from "cors";

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

export const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
        // No Origin header means this is not a browser (curl, Postman, health checks).
        if (!origin) {
            callback(null, true);
            return;
        }

        // Exact matches only, and "*" means nothing here: with credentials on,
        // a wildcard would let any website make requests as the signed-in user
        // and read the answers.
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
};
