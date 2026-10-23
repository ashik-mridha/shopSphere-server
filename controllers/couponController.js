import { z } from "zod";
import { patchSchema } from "../lib/zodUtils.js";
import { HttpError, col, pageMeta, parsePagination, toObjectId } from "../lib/http.js";

const base = z.object({
    code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, - and _ only"),
    type: z.enum(["percent", "fixed"]),
    value: z.number().positive(),
    minSubtotal: z.number().min(0).optional().default(0),
    maxUses: z.number().int().min(0).optional().default(0), // 0 = unlimited
    expiresAt: z.string().datetime({ offset: true }).or(z.string().date()).nullish(),
    active: z.boolean().optional().default(true),
    public: z.boolean().optional().default(false),
    description: z.string().trim().max(200).optional().default(""),
});

const percentCheck = (c) => c.type !== "percent" || c.value <= 100;
const percentMsg = { message: "Percent coupons cannot exceed 100", path: ["value"] };

export const couponSchema = base.refine(percentCheck, percentMsg);
export const couponUpdateSchema = patchSchema(base).refine((c) => c.type === undefined || percentCheck(c) || c.value === undefined, percentMsg);

const normalize = (body) => ({
    ...body,
    ...(body.code && { code: body.code.toUpperCase() }),
    ...("expiresAt" in body && { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }),
});

export async function getCoupons(req, res) {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 50 });
    const coupons = col(req, "coupons");
    const [items, total] = await Promise.all([
        coupons.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
        coupons.countDocuments({}),
    ]);
    res.json({ success: true, data: items, pagination: pageMeta(total, page, limit) });
}

export async function createCoupon(req, res) {
    const doc = { ...normalize(req.valid.body), usedCount: 0, createdAt: new Date() };
    const result = await col(req, "coupons").insertOne(doc);
    res.status(201).json({ success: true, message: "Coupon created", data: { ...doc, _id: result.insertedId } });
}

export async function updateCoupon(req, res) {
    const _id = toObjectId(req.params.id, "coupon ID");
    const updated = await col(req, "coupons").findOneAndUpdate(
        { _id },
        { $set: { ...normalize(req.valid.body), updatedAt: new Date() } },
        { returnDocument: "after" }
    );
    if (!updated) throw new HttpError(404, "Coupon not found");
    res.json({ success: true, message: "Coupon updated", data: updated });
}

export async function deleteCoupon(req, res) {
    const result = await col(req, "coupons").deleteOne({ _id: toObjectId(req.params.id, "coupon ID") });
    if (!result.deletedCount) throw new HttpError(404, "Coupon not found");
    res.json({ success: true, message: "Coupon deleted" });
}
