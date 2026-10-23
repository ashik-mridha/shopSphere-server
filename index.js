import app, { initializeRoutes } from "./app.js";
import { env } from "./config/env.js";
import { connectDB, closeDB } from "./config/database.js";

let server;
let isShuttingDown = false;

async function startServer() {
    try {
        const db = await connectDB();
        initializeRoutes(db);

        server = app.listen(env.port, () => {
            console.log(`ShopSphere API  http://localhost:${env.port}`);
            console.log(`Health          http://localhost:${env.port}/api/health`);
            console.log(`Stripe webhook  http://localhost:${env.port}/api/payments/webhook`);
            if (!env.stripeSecretKey) console.warn("STRIPE_SECRET_KEY is not set: payment endpoints will return 503.");
            if (env.stripeSecretKey && !env.stripeWebhookSecret) console.warn("STRIPE_WEBHOOK_SECRET is not set: webhooks will be rejected.");
        });
    } catch (error) {
        console.error("Server startup error:", error);
        await closeDB().catch(() => {});
        process.exitCode = 1;
    }
}

async function shutdown() {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log("Shutting down ShopSphere server...");

    try {
        if (server) await new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    } catch (error) {
        console.error("HTTP server shutdown error:", error);
    } finally {
        await closeDB().catch(() => {});
    }
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

startServer();
