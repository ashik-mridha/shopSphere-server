
import "dotenv/config";

import app, { initializeRoutes } from "../app.js";
import { connectDB } from "../config/database.js";

let initializationPromise;

async function initializeApp() {
    const db = await connectDB();
    initializeRoutes(db);
}

export default async function handler(req, res) {
    try {
        if (!initializationPromise) {
            initializationPromise = initializeApp().catch((error) => {
                initializationPromise = undefined;
                throw error;
            });
        }

        await initializationPromise;

        return app(req, res);
    } catch (error) {
        console.error("Vercel API initialization error:", error);

        return res.status(500).json({
            success: false,
            message: "Server initialization failed",
        });
    }
}
