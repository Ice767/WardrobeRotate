import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";

import {corsOptions} from "./config/cors.config";
import {errorHandler} from "./middlewares/error.middleware";
import authRouter from "./routes/auth.routes";
import referenceRouter from "./routes/reference.routes";
import userRouter from "./routes/user.routes";

const app = express();

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
app.use("/api", referenceRouter);

app.use(errorHandler);

export default app;
