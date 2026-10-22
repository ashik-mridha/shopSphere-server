
import "dotenv/config";

import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { jwt, admin } from "better-auth/plugins";
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "shopsphere";

if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from environment variables");
}
if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET is missing");
}


const client = new MongoClient(MONGODB_URI);

export const mongoClient = client;

const db = client.db(DB_NAME);

export const auth = betterAuth({
    database: mongodbAdapter(db, {
        client,
    }),

    baseURL:
        process.env.BETTER_AUTH_URL ||
        "http://localhost:5000",

    secret: process.env.BETTER_AUTH_SECRET,

    trustedOrigins: [
        process.env.CLIENT_URL ||
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
