import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";

import {corsOptions} from "./config/cors.config";
import {errorHandler} from "./middlewares/error.middleware";
import authRouter from "./routes/auth.routes";
import quoteRouter from "./routes/quote.routes";
import referenceRouter from "./routes/reference.routes";
import rfqRouter from "./routes/rfq.routes";
import shipmentRouter, {trackingRouter} from "./routes/shipment.routes";
import tariffRouter from "./routes/tariff.routes";
import userRouter from "./routes/user.routes";

const app = express();

// Behind a reverse proxy every request arrives from the proxy's address, and
// the rate limits would lump all users into one bucket. TRUST_PROXY is the
// number of proxies in front of the app; only then is X-Forwarded-For believed.
// Never set it when clients can reach the app directly: they could forge it.
const trustedProxyHops = Number(process.env.TRUST_PROXY ?? 0);

if (Number.isInteger(trustedProxyHops) && trustedProxyHops > 0) {
    app.set("trust proxy", trustedProxyHops);
}

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
    res.status(200).json({
        status: "OK",
        timestamp: new Date().toISOString(),
    });
});

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/tariffs", tariffRouter);
app.use("/api/rfqs", rfqRouter);
app.use("/api/shipments", shipmentRouter);
app.use("/api/track", trackingRouter);
app.use("/api", quoteRouter);
app.use("/api", referenceRouter);

app.use(errorHandler);

export default app;
