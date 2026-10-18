
import "dotenv/config";
import express from "express";
import {
    MongoClient,
    ServerApiVersion,
    ObjectId,
} from "mongodb";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./config/auth.js";
import cors from "cors";
import productRoutes from "./routes/productRoutes.js";

const app = express();

const PORT = Number(process.env.PORT) || 5000;
const uri = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "shopsphere";

// Validate environment variables
if (!uri) {
    throw new Error("MONGODB_URI is missing from your .env file");
}

// Middleware
app.use(
    cors({
        origin: process.env.CLIENT_URL || "http://localhost:5173",
        credentials: true,
    })
);

app.use(express.json({ limit: "1mb" }));

// MongoDB Client
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

// Root route
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "ShopSphere server is running",
    });
});

// Health check
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

// Better Auth routes
app.all("/api/auth/*splat", toNodeHandler(auth));

// Start server and initialize database
async function startServer() {
    try {
        await client.connect();

        db = client.db(DB_NAME);
        await db.command({ ping: 1 });

        console.log("MongoDB connected successfully!");

        // Collections
        const productsCollection = db.collection("products");
        const ordersCollection = db.collection("orders");

        // Product CRUD routes
        app.use(
            "/api/products",
            productRoutes(productsCollection)
        );

        console.log("Product routes initialized successfully");

        // ==========================================
        // CREATE ORDER
        // POST /api/orders
        // ==========================================
        app.post("/api/orders", async (req, res) => {
            try {
                const { productId, quantity, customer } = req.body;

                // Validate product ID
                if (
                    typeof productId !== "string" ||
                    !ObjectId.isValid(productId) ||
                    !new ObjectId(productId).toHexString().equals?.(productId)
                ) {
                    // Use the standard validation below instead.
                    if (
                        typeof productId !== "string" ||
                        !ObjectId.isValid(productId)
                    ) {
                        return res.status(400).json({
                            message: "Invalid product ID",
                        });
                    }
                }

                // Validate quantity
                if (
                    !Number.isInteger(quantity) ||
                    quantity < 1 ||
                    quantity > 99
                ) {
                    return res.status(400).json({
                        message: "Quantity must be between 1 and 99",
                    });
                }

                // Validate customer details
                const name =
                    typeof customer?.name === "string"
                        ? customer.name.trim()
                        : "";

                const phone =
                    typeof customer?.phone === "string"
                        ? customer.phone.trim()
                        : "";

                const address =
                    typeof customer?.address === "string"
                        ? customer.address.trim()
                        : "";

                if (
                    name.length < 2 ||
                    name.length > 100 ||
                    phone.length < 7 ||
                    phone.length > 20 ||
                    address.length < 5 ||
                    address.length > 500
                ) {
                    return res.status(400).json({
                        message: "Please provide valid customer details",
                    });
                }

                // Find product
                const product = await productsCollection.findOne({
                    _id: new ObjectId(productId),
                });

                if (!product) {
                    return res.status(404).json({
                        message: "Product not found",
                    });
                }

                // Validate price
                const unitPrice = Number(product.price);

                if (
                    !Number.isFinite(unitPrice) ||
                    unitPrice < 0
                ) {
                    return res.status(400).json({
                        message: "Product price is invalid",
                    });
                }

                const total = unitPrice * quantity;

                // Create order document
                const order = {
                    productId: product._id,
                    productTitle: product.title,
                    unitPrice,
                    quantity,
                    total,
                    customer: {
                        name,
                        phone,
                        address,
                    },
                    paymentMethod: "Cash on Delivery",
                    status: "Pending",
                    createdAt: new Date(),
                };

                const result = await ordersCollection.insertOne(order);

                return res.status(201).json({
                    success: true,
                    message: "Order placed successfully",
                    orderId: result.insertedId,
                    order: {
                        ...order,
                        _id: result.insertedId,
                    },
                });
            } catch (error) {
                console.error("Create order error:", error);

                return res.status(500).json({
                    success: false,
                    message: "Failed to place order",
                });
            }
        });

        console.log("Order routes initialized successfully");

        // ==========================================
        // GET ALL ORDERS
        // GET /api/orders
        // ==========================================
        app.get("/api/orders", async (req, res) => {
            try {
                const orders = await ordersCollection
                    .find({})
                    .sort({ createdAt: -1 })
                    .toArray();

                return res.status(200).json(orders);
            } catch (error) {
                console.error("Fetch orders error:", error);

                return res.status(500).json({
                    message: "Failed to fetch orders",
                });
            }
        });

        // Start listening only after database connects
        server = app.listen(PORT, () => {
            console.log(`Server: http://localhost:${PORT}`);
            console.log(`Products: http://localhost:${PORT}/api/products`);
            console.log(`Orders: http://localhost:${PORT}/api/orders`);
        });
    } catch (error) {
        console.error("Server startup error:", error.message);

        await client.close().catch(() => { });
        process.exitCode = 1;
    }
}

// Graceful shutdown
async function shutdown() {
    console.log("Shutting down ShopSphere server...");

    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }

    await client.close().catch(() => { });
    process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

startServer();
