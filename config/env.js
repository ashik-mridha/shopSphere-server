import "dotenv/config";

const isProd = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT) || 5000;

export const env = {
    isProd,
    port,
    mongoUri: process.env.MONGODB_URI,
    dbName: process.env.DB_NAME || "shopsphere",
    clientUrl: (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, ""),
    authUrl: (process.env.BETTER_AUTH_URL || `http://localhost:${port}`).replace(/\/+$/, ""),
    authSecret: process.env.BETTER_AUTH_SECRET,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    currency: (process.env.CURRENCY || "usd").toLowerCase(),
    taxRate: Number(process.env.TAX_RATE ?? 0.08),
    shippingFlat: Number(process.env.SHIPPING_FLAT ?? 5.99),
    freeShippingOver: Number(process.env.FREE_SHIPPING_OVER ?? 75),
};

if (!env.mongoUri) throw new Error("MONGODB_URI is missing from environment variables");
if (!env.authSecret) throw new Error("BETTER_AUTH_SECRET is missing from environment variables");
if (env.stripeSecretKey?.startsWith("sk_live_")) {
    throw new Error("Live Stripe keys are not allowed. Use a test key (sk_test_...).");
}
