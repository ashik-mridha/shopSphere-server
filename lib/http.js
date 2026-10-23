import { ObjectId } from "mongodb";

export class HttpError extends Error {
    constructor(status, message, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

export const isObjectId = (value) => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

export function toObjectId(value, label = "ID") {
    if (!isObjectId(value)) throw new HttpError(400, `Invalid ${label}`);
    return new ObjectId(value);
}

export const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const toCents = (n) => Math.round(Number(n) * 100);

export const slugify = (text) =>
    String(text)
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");

export function parsePagination(query, { defaultLimit = 12, maxLimit = 60 } = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
    return { page, limit, skip: (page - 1) * limit };
}

export function pageMeta(total, page, limit) {
    return { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

export const col = (req, name) => req.app.locals.db.collection(name);
