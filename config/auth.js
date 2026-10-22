import "dotenv/config";

import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { jwt, admin } from "better-auth/plugins";
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "shopsphere";

const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET;

// dynamic URL resolution (Vercel Production & Local Development)
const BETTER_AUTH_URL =
    process.env.BETTER_AUTH_URL || "https://shop-sphere-server-three.vercel.app";

const CLIENT_URL =
    process.env.CLIENT_URL || "https://shop-sphere-green-five.vercel.app";

if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from environment variables");
}

if (!BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET is missing from environment variables");
}

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn("Google OAuth credentials are missing");
}

const client = new MongoClient(MONGODB_URI);

export const mongoClient = client;

const db = client.db(DB_NAME);

export const auth = betterAuth({
    database: mongodbAdapter(db, {
        client,
    }),

    // Base URL dynamically from environment variable
    baseURL: BETTER_AUTH_URL,

    secret: BETTER_AUTH_SECRET,

    // Trusted frontend Origins and Client URLs
    trustedOrigins: [
        CLIENT_URL,
        "https://shop-sphere-green-five.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000"
    ],

    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
    },

    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            // Google auth success/fail redirect handling
            redirectURI: `${BETTER_AUTH_URL}/api/auth/callback/google`,
        },
    },

    // Session and Cross-Domain Cookie settings for Vercel
    advanced: {
        crossSubDomainCookies: {
            enabled: true,
        },
        defaultCookieAttributes: {
            sameSite: "none",
            secure: true,
        },
    },

    plugins: [
        admin(),
        jwt(),
    ],
});