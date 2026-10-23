import { z } from "zod";
import { HttpError, col, toObjectId } from "../lib/http.js";

export const addressSchema = z.object({
    label: z.string().trim().max(30).optional().default("Home"),
    fullName: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(7).max(20),
    line1: z.string().trim().min(3).max(150),
    line2: z.string().trim().max(150).optional().default(""),
    city: z.string().trim().min(2).max(80),
    state: z.string().trim().min(1).max(80),
    postalCode: z.string().trim().min(3).max(12),
    country: z.string().trim().length(2, "Use a 2-letter country code").toUpperCase(),
    isDefault: z.boolean().optional().default(false),
});

async function clearDefault(req, exceptId) {
    await col(req, "addresses").updateMany(
        { userId: req.user.id, ...(exceptId && { _id: { $ne: exceptId } }) },
        { $set: { isDefault: false } }
    );
}

export async function getAddresses(req, res) {
    const items = await col(req, "addresses").find({ userId: req.user.id }).sort({ isDefault: -1, createdAt: -1 }).toArray();
    res.json({ success: true, data: items });
}

export async function createAddress(req, res) {
    const addresses = col(req, "addresses");
    const count = await addresses.countDocuments({ userId: req.user.id });
    if (count >= 10) throw new HttpError(400, "You can save up to 10 addresses.");

    const doc = { ...req.valid.body, userId: req.user.id, isDefault: req.valid.body.isDefault || count === 0, createdAt: new Date() };
    if (doc.isDefault) await clearDefault(req);

    const result = await addresses.insertOne(doc);
    res.status(201).json({ success: true, message: "Address saved", data: { ...doc, _id: result.insertedId } });
}

export async function updateAddress(req, res) {
    const _id = toObjectId(req.params.id, "address ID");
    const updated = await col(req, "addresses").findOneAndUpdate(
        { _id, userId: req.user.id },
        { $set: { ...req.valid.body, updatedAt: new Date() } },
        { returnDocument: "after" }
    );
    if (!updated) throw new HttpError(404, "Address not found");
    if (req.valid.body.isDefault) await clearDefault(req, _id);
    res.json({ success: true, message: "Address updated", data: updated });
}

export async function deleteAddress(req, res) {
    const _id = toObjectId(req.params.id, "address ID");
    const removed = await col(req, "addresses").findOneAndDelete({ _id, userId: req.user.id });
    if (!removed) throw new HttpError(404, "Address not found");

    if (removed.isDefault) {
        const next = await col(req, "addresses").findOne({ userId: req.user.id }, { sort: { createdAt: -1 } });
        if (next) await col(req, "addresses").updateOne({ _id: next._id }, { $set: { isDefault: true } });
    }
    res.json({ success: true, message: "Address removed" });
}
