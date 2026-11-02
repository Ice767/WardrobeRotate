import "dotenv/config";

import app from "./app";
import {logger} from "./config/logger.config";
import {seedDemoData} from "./data/seed";

const PORT = process.env.PORT ?? 3100;

seedDemoData()
    .then(() => {
        app.listen(PORT, () => {
            logger.info({port: PORT, storage: process.env.DATABASE_URL ? "postgres" : "memory"}, "Server is running");
        });
    })
    .catch((error) => {
        // The server does not come up at all: without its tables or an admin the
        // system is unusable, and failing at startup beats a 500 on every request.
        logger.error({err: error}, "Failed to prepare storage or seed initial data");
        process.exit(1);
    });
