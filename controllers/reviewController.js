import { z } from "zod";
import { HttpError, col, escapeRegex, pageMeta, parsePagination, toObjectId, isObjectId } from "../lib/http.js";

export const reviewSchema = z.object({
    rating: z.number().int().min(1).max(5),
    title: z.string().trim().max(100).optional().default(""),
    comment: z.string().trim().min(10, "Please write at least 10 characters").max(2000),
});

export const reviewModerationSchema = z.object({ status: z.enum(["approved", "hidden"]) });

async function resolveProduct(req) {
    const { idOrSlug } = req.params;
    const filter = isObjectId(idOrSlug) ? { _id: toObjectId(idOrSlug) } : { slug: idOrSlug };
    const product = await col(req, "products").findOne(filter, { projection: { _id: 1, title: 1 } });
    if (!product) throw new HttpError(404, "Product not found");
    return product;
}

export async function recomputeRating(db, productId) {
    const [agg] = await db
        .collection("reviews")
        .aggregate([
            { $match: { productId, status: "approved" } },
            { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
        ])
        .toArray();
    await db.collection("products").updateOne(
        { _id: productId },
        { $set: { rating: agg ? Math.round(agg.avg * 10) / 10 : 0, reviewCount: agg?.count || 0 } }
    );
}

const hasPurchased = (db, userId, productId) =>
    db.collection("orders").findOne({ userId, paymentStatus: "paid", "items.productId": productId }, { projection: { _id: 1 } });

export async function getProductReviews(req, res) {
    const product = await resolveProduct(req);
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 6, maxLimit: 30 });
    const reviews = col(req, "reviews");
    const filter = { productId: product._id, status: "approved" };

    const [items, total, dist] = await Promise.all([
        reviews.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
        reviews.countDocuments(filter),
        reviews.aggregate([{ $match: filter }, { $group: { _id: "$rating", count: { $sum: 1 } } }]).toArray(),
    ]);

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    dist.forEach((d) => {
        distribution[d._id] = d.count;
    });

    res.json({ success: true, data: items, distribution, pagination: pageMeta(total, page, limit) });
}

export async function getReviewEligibility(req, res) {
    const product = await resolveProduct(req);
    if (!req.user) return res.json({ success: true, data: { canReview: false, reason: "login" } });

    const db = req.app.locals.db;
    const existing = await db.collection("reviews").findOne({ productId: product._id, userId: req.user.id });
    if (existing) return res.json({ success: true, data: { canReview: false, reason: "already_reviewed" } });

    const purchased = await hasPurchased(db, req.user.id, product._id);
    res.json({ success: true, data: { canReview: Boolean(purchased), reason: purchased ? null : "not_purchased" } });
}

export async function createReview(req, res) {
    const product = await resolveProduct(req);
    const db = req.app.locals.db;

    if (!(await hasPurchased(db, req.user.id, product._id))) {
        throw new HttpError(403, "Only customers who bought this product can review it.");
    }

    const doc = {
        productId: product._id,
        productTitle: product.title,
        userId: req.user.id,
        userName: req.user.name,
        userImage: req.user.image,
        ...req.valid.body,
        verifiedPurchase: true,
        status: "approved",
        createdAt: new Date(),
    };

    try {
        const result = await db.collection("reviews").insertOne(doc);
        await recomputeRating(db, product._id);
        res.status(201).json({ success: true, message: "Thanks for your review!", data: { ...doc, _id: result.insertedId } });
    } catch (err) {
        if (err.code === 11000) throw new HttpError(409, "You have already reviewed this product.");
        throw err;
    }
}

// Homepage testimonials: best recent verified reviews
export async function getFeaturedReviews(req, res) {
    const items = await col(req, "reviews")
        .find({ status: "approved", rating: { $gte: 4 }, "comment": { $exists: true } })
        .sort({ rating: -1, createdAt: -1 })
        .limit(6)
        .toArray();
    res.json({ success: true, data: items });
}

// ---- admin moderation ----
export async function getAdminReviews(req, res) {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 50 });
    const filter = {};
    if (["approved", "hidden"].includes(req.query.status)) filter.status = req.query.status;
    if (req.query.rating) filter.rating = Number(req.query.rating);
    if (typeof req.query.q === "string" && req.query.q.trim()) {
        const rx = new RegExp(escapeRegex(req.query.q.trim().slice(0, 100)), "i");
        filter.$or = [{ comment: rx }, { userName: rx }, { productTitle: rx }];
    }
    const reviews = col(req, "reviews");
    const sort = req.query.sort === "rating" ? { rating: -1, createdAt: -1 } : { createdAt: -1 };
    const [items, total] = await Promise.all([
        reviews.find(filter).sort(sort).skip(skip).limit(limit).toArray(),
        reviews.countDocuments(filter),
    ]);
    res.json({ success: true, data: items, pagination: pageMeta(total, page, limit) });
}

export async function moderateReview(req, res) {
    const _id = toObjectId(req.params.id, "review ID");
    const review = await col(req, "reviews").findOneAndUpdate(
        { _id },
        { $set: { status: req.valid.body.status } },
        { returnDocument: "after" }
    );
    if (!review) throw new HttpError(404, "Review not found");
    await recomputeRating(req.app.locals.db, review.productId);
    res.json({ success: true, message: "Review updated", data: review });
}

export async function deleteReview(req, res) {
    const _id = toObjectId(req.params.id, "review ID");
    const review = await col(req, "reviews").findOneAndDelete({ _id });
    if (!review) throw new HttpError(404, "Review not found");
    await recomputeRating(req.app.locals.db, review.productId);
    res.json({ success: true, message: "Review deleted" });
}
