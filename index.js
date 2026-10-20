
import "dotenv/config";

import app, { initializeRoutes } from "./app.js";
import { connectDB, closeDB } from "./config/database.js";
import { mongoClient } from "./config/auth.js";

const PORT = Number(process.env.PORT) || 5000;

let server;
let isShuttingDown = false;

async function startServer() {
    try {
        const db = await connectDB();

        initializeRoutes(db);

        server = app.listen(PORT, () => {
            console.log(`Server: http://localhost:${PORT}`);
            console.log(`Health: http://localhost:${PORT}/api/health`);
            console.log(`Products: http://localhost:${PORT}/api/products`);
            console.log(`Orders: http://localhost:${PORT}/api/orders`);
            console.log(`Admin users: http://localhost:${PORT}/api/admin/users`);
        });
    } catch (error) {
        console.error("Server startup error:", error);

        await Promise.allSettled([
            closeDB(),
            mongoClient.close(),
        ]);

        process.exitCode = 1;
    }
}

async function shutdown() {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log("Shutting down ShopSphere server...");

    try {
        if (server) {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
        }
    } catch (error) {
        console.error("HTTP server shutdown error:", error);
    } finally {
        await Promise.allSettled([
            closeDB(),
            mongoClient.close(),
        ]);
    }
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

startServer();
