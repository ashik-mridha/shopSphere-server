import { HttpError } from "../lib/http.js";

export const validate = (schema, source = "body") => (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
        const details = result.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
        }));
        const first = details[0];
        return next(
            new HttpError(400, first ? `${first.field ? first.field + ": " : ""}${first.message}` : "Invalid input", details)
        );
    }
    // Express 5 makes req.query read-only, so parsed data lives on req.valid.
    req.valid = { ...(req.valid || {}), [source]: result.data };
    next();
};
