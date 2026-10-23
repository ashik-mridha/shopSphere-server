import express from "express";
import cors from "cors";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";

import { env } from "./config/env.js";
import { auth } from "./config/auth.js";
import apiRoutes from "./routes/index.js";
import { handleWebhook } from "./controllers/paymentController.js";
import { authLimiter } from "./middleware/rateLimit.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: env.clientUrl, credentials: true }));

// Stripe needs the exact raw bytes to verify its signature, so this route MUST be
// registered before express.json() parses (and consumes) the body.
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), handleWebhook);

// Better Auth parses its own body, so it also sits before express.json().
app.use("/api/auth", authLimiter);
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
    res.json({ success: true, message: "ShopSphere API is running" });
});

app.get("/api/health", async (req, res) => {
    try {
        await req.app.locals.db.command({ ping: 1 });
        res.json({ success: true, message: "MongoDB connected", database: env.dbName });
    } catch {
        res.status(503).json({ success: false, message: "Database unavailable" });
    }
});

export function initializeRoutes(db) {
    app.locals.db = db;
    app.use("/api", apiRoutes);
    app.use(notFound);
    app.use(errorHandler);
}

export default app;
