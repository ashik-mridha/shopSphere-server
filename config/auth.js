
import "dotenv/config";

import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { jwt, admin } from "better-auth/plugins";
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "shopsphere";

const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET;
const BETTER_AUTH_URL =
    process.env.BETTER_AUTH_URL || "http://localhost:5000";

const CLIENT_URL =
    process.env.CLIENT_URL || "http://localhost:5173";

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

    baseURL: "https://shop-sphere-server-three.vercel.app",

    secret: process.env.BETTER_AUTH_SECRET,

    trustedOrigins: [
        "https://shop-sphere-green-five.vercel.app",
        "http://localhost:5173",
    ],

    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
    },

    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
    },

    plugins: [
        admin(),
        jwt(),
    ],
});