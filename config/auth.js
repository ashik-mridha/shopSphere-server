
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { jwt } from "better-auth/plugins";
import { admin } from "better-auth/plugins";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);

export const mongoClient = client;

export const auth = betterAuth({
    database: mongodbAdapter(
        client.db(process.env.DB_NAME || "shopsphere"),
        { client }
    ),

    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,

    trustedOrigins: [
        process.env.CLIENT_URL,
    ],

    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
    },

    plugins: [
        admin(),
        jwt(),
    ],
});
