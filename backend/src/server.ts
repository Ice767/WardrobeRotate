import "dotenv/config";

import app from "./app";
import {logger} from "./config/logger.config";
import {seedDemoData} from "./data/seed";

const PORT = process.env.PORT ?? 3100;

seedDemoData()
    .then(() => {
        app.listen(PORT, () => {
            logger.info({port: PORT}, "Server is running");
        });
    })
    .catch((error) => {
        // The server does not come up at all: without an admin the system is
        // unusable, and failing at startup beats returning 500 on every request.
        logger.error({err: error}, "Failed to seed initial data");
        process.exit(1);
    });
