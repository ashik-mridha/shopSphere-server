import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../config/auth.js";
import { HttpError } from "../lib/http.js";

async function loadSession(req) {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    return session?.user ? session : null;
}

function attach(req, session) {
    req.user = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role || "user",
        image: session.user.image || null,
    };
}

export async function optionalAuth(req, _res, next) {
    try {
        const session = await loadSession(req);
        if (session) attach(req, session);
    } catch {
        // treated as a guest
    }
    next();
}

export async function requireAuth(req, _res, next) {
    let session;
    try {
        session = await loadSession(req);
    } catch {
        return next(new HttpError(401, "Unable to verify your session."));
    }
    if (!session) return next(new HttpError(401, "Please log in first."));
    if (session.user.banned) return next(new HttpError(403, "This account has been blocked."));
    attach(req, session);
    next();
}

export function requireAdmin(req, res, next) {
    requireAuth(req, res, (err) => {
        if (err) return next(err);
        if (req.user.role !== "admin") return next(new HttpError(403, "Admin access required."));
        next();
    });
}
