import rateLimit from "express-rate-limit";

const make = (windowMs, limit, message, skip) =>
    rateLimit({
        windowMs,
        limit,
        skip,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        message: { success: false, message },
    });

// Only sign-in / sign-up / password calls (POST) are limited; the SPA polls GET /get-session on every page.
export const authLimiter = make(15 * 60 * 1000, 60, "Too many attempts. Please try again in a few minutes.", (req) => req.method !== "POST");
export const paymentLimiter = make(60 * 1000, 20, "Too many payment requests. Please slow down.");
export const publicWriteLimiter = make(60 * 60 * 1000, 20, "Too many submissions. Please try again later.");
