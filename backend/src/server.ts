import "dotenv/config";

import app from "./app";
import {logger} from "./config/logger.config";

const PORT = process.env.PORT ?? 3100;

app.listen(PORT, () => {
    logger.info({port: PORT}, "Server is running");
});
