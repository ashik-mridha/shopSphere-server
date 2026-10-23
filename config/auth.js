import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { jwt, admin } from "better-auth/plugins";
import { MongoClient } from "mongodb";
import { env } from "./env.js";

export const mongoClient = new MongoClient(env.mongoUri, {
    serverSelectionTimeoutMS: 10000,
});

const authDb = mongoClient.db(env.dbName);

const trustedOrigins = [env.clientUrl];
if (!env.isProd) trustedOrigins.push("http://localhost:5173", "http://127.0.0.1:5173");

const hasGoogle = Boolean(env.googleClientId && env.googleClientSecret);

export const auth = betterAuth({
    database: mongodbAdapter(authDb, { client: mongoClient }),
    baseURL: env.authUrl,
    secret: env.authSecret,
    trustedOrigins,

    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
    },

    ...(hasGoogle && {
        socialProviders: {
            google: {
                clientId: env.googleClientId,
                clientSecret: env.googleClientSecret,
                redirectURI: `${env.authUrl}/api/auth/callback/google`,
            },
        },
    }),

    // Cross-site cookies are only needed when the SPA and API live on different sites (production).
    advanced: env.isProd
        ? { defaultCookieAttributes: { sameSite: "none", secure: true } }
        : {},

    plugins: [admin(), jwt()],
});
