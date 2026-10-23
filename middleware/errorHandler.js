import { env } from "../config/env.js";

export function notFound(req, res) {
    res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
    if (res.headersSent) return;

    let status = err.status || err.statusCode || 500;
    let message = err.message;

    if (err.type === "entity.parse.failed") {
        status = 400;
        message = "Malformed JSON body.";
    } else if (err.code === 11000) {
        status = 409;
        message = "A record with these details already exists.";
    }

    if (status >= 500) {
        console.error(`[${req.method} ${req.originalUrl}]`, err);
        if (env.isProd) message = "Something went wrong on our side.";
    }

    res.status(status).json({
        success: false,
        message,
        ...(err.details && { details: err.details }),
    });
}
