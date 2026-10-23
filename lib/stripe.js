import Stripe from "stripe";
import { env } from "../config/env.js";
import { HttpError } from "./http.js";

let client;

export function getStripe() {
    if (!env.stripeSecretKey) {
        throw new HttpError(503, "Payments are not configured on this server (STRIPE_SECRET_KEY is missing).");
    }
    client ??= new Stripe(env.stripeSecretKey);
    return client;
}

export const isStripeConfigured = () => Boolean(env.stripeSecretKey);
