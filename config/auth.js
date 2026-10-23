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

// Same origin means the SPA host proxies /api/* to this server (BETTER_AUTH_URL == CLIENT_URL).
const sameSite = new URL(env.authUrl).origin === new URL(env.clientUrl).origin;
if (env.isProd && /localhost|127\.0\.0\.1/.test(env.authUrl)) {
    console.warn("BETTER_AUTH_URL points to localhost in production: sign-in and Google callbacks will fail.");
}

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

    // Cookie policy:
    //  - API served from the same site as the SPA (dev proxy, or the SPA host rewriting /api/* to this server):
    //    first-party cookies, SameSite=Lax. This is the recommended production setup.
    //  - API on a different site: SameSite=None; Secure so the cookie can be sent cross-site. Browsers that block
    //    third-party cookies (Safari, Chrome incognito) will still drop it, so prefer the rewrite setup.
    advanced: env.isProd && !sameSite
        ? { defaultCookieAttributes: { sameSite: "none", secure: true } }
        : {},

    plugins: [admin(), jwt()],
});
