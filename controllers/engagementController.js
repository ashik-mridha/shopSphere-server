import { z } from "zod";
import { HttpError, col, escapeRegex, pageMeta, parsePagination, toObjectId } from "../lib/http.js";

// ---------- contact messages ----------
export const contactSchema = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email().max(200),
    subject: z.string().trim().min(3).max(150),
    message: z.string().trim().min(10).max(3000),
});

export const messageStatusSchema = z.object({ status: z.enum(["new", "read", "replied", "archived"]) });

export async function createMessage(req, res) {
    const doc = { ...req.valid.body, status: "new", createdAt: new Date() };
    await col(req, "messages").insertOne(doc);
    res.status(201).json({ success: true, message: "Thanks! Your message has been received. We usually reply within one business day." });
}

export async function getMessages(req, res) {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 50 });
    const filter = {};
    if (["new", "read", "replied", "archived"].includes(req.query.status)) filter.status = req.query.status;
    if (typeof req.query.q === "string" && req.query.q.trim()) {
        const rx = new RegExp(escapeRegex(req.query.q.trim().slice(0, 100)), "i");
        filter.$or = [{ name: rx }, { email: rx }, { subject: rx }, { message: rx }];
    }
    const messages = col(req, "messages");
    const [items, total] = await Promise.all([
        messages.find(filter).sort({ createdAt: req.query.sort === "oldest" ? 1 : -1 }).skip(skip).limit(limit).toArray(),
        messages.countDocuments(filter),
    ]);
    res.json({ success: true, data: items, pagination: pageMeta(total, page, limit) });
}

export async function updateMessage(req, res) {
    const updated = await col(req, "messages").findOneAndUpdate(
        { _id: toObjectId(req.params.id, "message ID") },
        { $set: { status: req.valid.body.status, updatedAt: new Date() } },
        { returnDocument: "after" }
    );
    if (!updated) throw new HttpError(404, "Message not found");
    res.json({ success: true, message: "Message updated", data: updated });
}

export async function deleteMessage(req, res) {
    const result = await col(req, "messages").deleteOne({ _id: toObjectId(req.params.id, "message ID") });
    if (!result.deletedCount) throw new HttpError(404, "Message not found");
    res.json({ success: true, message: "Message deleted" });
}

// ---------- newsletter ----------
export const newsletterSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200) });

export async function subscribeNewsletter(req, res) {
    const { email } = req.valid.body;
    const result = await col(req, "newsletter").updateOne(
        { email },
        { $setOnInsert: { email, createdAt: new Date() } },
        { upsert: true }
    );
    res.status(result.upsertedCount ? 201 : 200).json({
        success: true,
        message: result.upsertedCount ? "You're subscribed. Welcome to ShopSphere!" : "This email is already subscribed.",
    });
}

// ---------- faqs ----------
export async function getFaqs(req, res) {
    const items = await col(req, "faqs").find({}).sort({ order: 1 }).toArray();
    res.json({ success: true, data: items });
}
