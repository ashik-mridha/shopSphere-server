
import express from "express";
import cors from "cors";

import { toNodeHandler } from "better-auth/node";
import { auth } from "./config/auth.js";

import orderRoutes from "./routes/orderRoutes.js";
import adminUserRoutes from "./routes/adminUserRoutes.js";
import productRoutes from "./routes/productRoutes.js";

const CLIENT_URL =
    process.env.CLIENT_URL || "http://localhost:5173";

const app = express();

// Middleware
app.use(
    cors({
        origin: CLIENT_URL,
        credentials: true,
    })
);

app.use(express.json({ limit: "1mb" }));

// Root
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "ShopSphere server is running",
    });
});

// Health check
app.get("/api/health", async (req, res) => {
    try {
        const db = req.app.locals.db;

        if (!db) {
            return res.status(503).json({
                success: false,
                message: "Database is not initialized",
            });
        }

        await db.command({ ping: 1 });

        return res.status(200).json({
            success: true,
            message: "MongoDB connected successfully",
            database: process.env.DB_NAME || "shopsphere",
        });
    } catch (error) {
        console.error("Health check failed:", error.message);

        return res.status(503).json({
            success: false,
            message: "Database unavailable",
        });
    }
});

// Better Auth
app.all("/api/auth/*splat", toNodeHandler(auth));

// Initialize database-dependent routes
export function initializeRoutes(db) {
    app.locals.db = db;

    const productsCollection = db.collection("products");
    const ordersCollection = db.collection("orders");

    app.use("/api/products", productRoutes(productsCollection));

    app.use(
        "/api/orders",
        orderRoutes({
            productsCollection,
            ordersCollection,
        })
    );

    app.use(
        "/api/admin/users",
        adminUserRoutes({ db, auth })
    );

    console.log("Product routes initialized successfully");
    console.log("Order routes initialized successfully");
    console.log("Admin users route initialized successfully");
}

export default app;
