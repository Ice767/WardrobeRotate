import "dotenv/config";

import app from "./app";
import {jwtConfig} from "./config/jwt.config";
import {logger} from "./config/logger.config";
import {seedDemoData} from "./data/seed";

const PORT = process.env.PORT ?? 3100;

const start = async (): Promise<void> => {
    // Read once up front: the getter throws when the secret is missing, and
    // that should stop the server here, not fail the first sign-in.
    void jwtConfig.accessSecret;

    await seedDemoData();
};

start()
    .then(() => {
        app.listen(PORT, () => {
            logger.info({port: PORT}, "Server is running");
        });
    })
    .catch((error) => {
        // The server does not come up at all: without its secret or an admin the
        // system is unusable, and failing at startup beats a 500 on every request.
        logger.error({err: error}, "Failed to start");
        process.exit(1);
    });
