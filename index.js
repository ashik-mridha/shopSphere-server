import "dotenv/config";
import express from "express";
import { MongoClient, ServerApiVersion } from "mongodb";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./config/auth.js";
import cors from "cors";

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const uri = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "shopsphere";

app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
}));

app.use(express.json());


app.all("/api/auth/*splat", toNodeHandler(auth));

if (!uri) {
    throw new Error("MONGODB_URI is missing from your .env file");
}

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
    serverSelectionTimeoutMS: 10000,
});

let db;
let server;

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "ShopSphere server is running",
    });
});

app.get("/api/health", async (req, res) => {
    try {
        await db.command({ ping: 1 });

        res.status(200).json({
            success: true,
            message: "MongoDB connected successfully",
            database: DB_NAME,
        });
    } catch (error) {
        console.error("Health check failed:", error.message);

        res.status(503).json({
            success: false,
            message: "Database unavailable",
        });
    }
});

async function startServer() {
    try {
        await client.connect();

        db = client.db(DB_NAME);
        await db.command({ ping: 1 });

        console.log("MongoDB connected successfully!");

        server = app.listen(PORT, () => {
            console.log(`Server: http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("MongoDB connection error:", error.message);
        await client.close().catch(() => { });
        process.exitCode = 1;
    }
}

async function shutdown() {
    console.log("Shutting down...");

    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }

    await client.close();
    process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

startServer();