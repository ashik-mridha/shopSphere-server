import { z } from "zod";
import { patchSchema } from "../lib/zodUtils.js";
import { HttpError, col, escapeRegex, pageMeta, parsePagination, round2, slugify, toObjectId, isObjectId } from "../lib/http.js";

export const productSchema = z.object({
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().min(10).max(5000),
    price: z.number().min(0).max(1_000_000),
    compareAtPrice: z.number().min(0).max(1_000_000).nullish(),
    category: z.string().trim().min(1).max(80),
    brand: z.string().trim().max(80).optional().default(""),
    image: z.string().trim().min(1).max(500),
    images: z.array(z.string().trim().min(1).max(500)).max(10).optional().default([]),
    stock: z.number().int().min(0).max(1_000_000),
    sku: z.string().trim().max(60).optional().default(""),
    specs: z
        .array(z.object({ label: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(200) }))
        .max(20)
        .optional()
        .default([]),
    colors: z.array(z.string().trim().min(1).max(30)).max(12).optional().default([]),
    sizes: z.array(z.string().trim().min(1).max(30)).max(12).optional().default([]),
    featured: z.boolean().optional().default(false),
    isNew: z.boolean().optional().default(false),
    status: z.enum(["active", "draft"]).optional().default("active"),
});

export const productUpdateSchema = patchSchema(productSchema);

export const listQuerySchema = z.object({
    q: z.string().trim().max(100).optional(),
    category: z.string().trim().max(80).optional(),
    brand: z.string().trim().max(80).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    rating: z.coerce.number().min(0).max(5).optional(),
    sort: z.enum(["newest", "price-asc", "price-desc", "rating", "popular", "discount", "stock-asc", "stock-desc", "title"]).optional().default("newest"),
    featured: z.enum(["true", "false"]).optional(),
    isNew: z.enum(["true", "false"]).optional(),
    onSale: z.enum(["true", "false"]).optional(),
    inStock: z.enum(["true", "false"]).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    status: z.enum(["active", "draft", "all"]).optional(),
});

const SORTS = {
    newest: { createdAt: -1 },
    "price-asc": { price: 1, _id: 1 },
    "price-desc": { price: -1, _id: 1 },
    rating: { rating: -1, reviewCount: -1, _id: 1 },
    popular: { sold: -1, reviewCount: -1, _id: 1 },
    discount: { discountPercent: -1, _id: 1 },
    "stock-asc": { stock: 1, _id: 1 },
    "stock-desc": { stock: -1, _id: 1 },
    title: { title: 1 },
};

function withDiscount(data) {
    const compare = data.compareAtPrice;
    const hasDiscount = compare != null && compare > data.price;
    return {
        ...data,
        compareAtPrice: hasDiscount ? compare : null,
        discountPercent: hasDiscount ? Math.round(((compare - data.price) / compare) * 100) : 0,
        price: round2(data.price),
    };
}

async function uniqueSlug(products, title, excludeId) {
    const base = slugify(title) || "product";
    let slug = base;
    let n = 1;
    // eslint-disable-next-line no-await-in-loop
    while (await products.findOne({ slug, ...(excludeId && { _id: { $ne: excludeId } }) }, { projection: { _id: 1 } })) {
        n += 1;
        slug = `${base}-${n}`;
    }
    return slug;
}

export function buildProductFilter(q, { admin = false } = {}) {
    const filter = {};
    if (!admin || !q.status || q.status === "active") filter.status = { $ne: "draft" };
    if (admin && q.status === "draft") filter.status = "draft";
    if (admin && q.status === "all") delete filter.status;

    if (q.q) {
        const rx = new RegExp(escapeRegex(q.q), "i");
        filter.$or = [{ title: rx }, { brand: rx }, { category: rx }, { description: rx }, { sku: rx }];
    }
    if (q.category) filter.category = q.category;
    if (q.brand) filter.brand = q.brand;
    if (q.minPrice != null || q.maxPrice != null) {
        filter.price = {};
        if (q.minPrice != null) filter.price.$gte = q.minPrice;
        if (q.maxPrice != null) filter.price.$lte = q.maxPrice;
    }
    if (q.rating) filter.rating = { $gte: q.rating };
    if (q.featured) filter.featured = q.featured === "true";
    if (q.isNew) filter.isNew = q.isNew === "true";
    if (q.onSale === "true") filter.discountPercent = { $gt: 0 };
    if (q.inStock === "true") filter.stock = { $gt: 0 };
    return filter;
}

async function listProducts(req, res, { admin }) {
    const q = req.valid.query;
    const { page, limit, skip } = parsePagination(q, { defaultLimit: 12, maxLimit: 100 });
    const products = col(req, "products");
    const filter = buildProductFilter(q, { admin });

    const [items, total] = await Promise.all([
        products.find(filter).sort(SORTS[q.sort]).skip(skip).limit(limit).toArray(),
        products.countDocuments(filter),
    ]);

    res.json({ success: true, data: items, pagination: pageMeta(total, page, limit) });
}

export const getProducts = (req, res) => listProducts(req, res, { admin: false });
export const getAdminProducts = (req, res) => listProducts(req, res, { admin: true });

export async function getProduct(req, res) {
    const { idOrSlug } = req.params;
    const filter = isObjectId(idOrSlug) ? { _id: toObjectId(idOrSlug) } : { slug: idOrSlug };
    const product = await col(req, "products").findOne(filter);
    if (!product || (product.status === "draft" && req.user?.role !== "admin")) {
        throw new HttpError(404, "Product not found");
    }
    res.json({ success: true, data: product });
}

export async function getRelated(req, res) {
    const products = col(req, "products");
    const filter = isObjectId(req.params.idOrSlug) ? { _id: toObjectId(req.params.idOrSlug) } : { slug: req.params.idOrSlug };
    const product = await products.findOne(filter, { projection: { category: 1 } });
    if (!product) throw new HttpError(404, "Product not found");

    const related = await products
        .find({ category: product.category, _id: { $ne: product._id }, status: { $ne: "draft" } })
        .sort({ rating: -1, sold: -1 })
        .limit(4)
        .toArray();
    res.json({ success: true, data: related });
}

export async function getFilterMeta(req, res) {
    const products = col(req, "products");
    const [brands, range] = await Promise.all([
        products.distinct("brand", { status: { $ne: "draft" }, brand: { $ne: "" } }),
        products
            .aggregate([
                { $match: { status: { $ne: "draft" } } },
                { $group: { _id: null, min: { $min: "$price" }, max: { $max: "$price" } } },
            ])
            .toArray(),
    ]);
    res.json({
        success: true,
        data: {
            brands: brands.sort(),
            minPrice: Math.floor(range[0]?.min ?? 0),
            maxPrice: Math.ceil(range[0]?.max ?? 0),
        },
    });
}

export async function createProduct(req, res) {
    const products = col(req, "products");
    const body = req.valid.body;

    const category = await col(req, "categories").findOne({ slug: body.category });
    if (!category) throw new HttpError(400, "Selected category does not exist.");

    const doc = {
        ...withDiscount(body),
        slug: await uniqueSlug(products, body.title),
        rating: 0,
        reviewCount: 0,
        sold: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    if (!doc.images.length) doc.images = [doc.image];

    const result = await products.insertOne(doc);
    res.status(201).json({ success: true, message: "Product created", data: { ...doc, _id: result.insertedId } });
}

export async function updateProduct(req, res) {
    const products = col(req, "products");
    const _id = toObjectId(req.params.id, "product ID");
    const existing = await products.findOne({ _id });
    if (!existing) throw new HttpError(404, "Product not found");

    const body = req.valid.body;
    if (body.category) {
        const category = await col(req, "categories").findOne({ slug: body.category });
        if (!category) throw new HttpError(400, "Selected category does not exist.");
    }

    const merged = withDiscount({ ...existing, ...body });
    const set = {
        ...Object.fromEntries(Object.keys(body).map((k) => [k, merged[k]])),
        compareAtPrice: merged.compareAtPrice,
        discountPercent: merged.discountPercent,
        price: merged.price,
        updatedAt: new Date(),
    };
    if (body.title && body.title !== existing.title) set.slug = await uniqueSlug(products, body.title, _id);

    const updated = await products.findOneAndUpdate({ _id }, { $set: set }, { returnDocument: "after" });
    res.json({ success: true, message: "Product updated", data: updated });
}

export async function deleteProduct(req, res) {
    const _id = toObjectId(req.params.id, "product ID");
    const result = await col(req, "products").deleteOne({ _id });
    if (!result.deletedCount) throw new HttpError(404, "Product not found");
    await Promise.all([
        col(req, "reviews").deleteMany({ productId: _id }),
        col(req, "wishlists").updateMany({}, { $pull: { productIds: _id } }),
    ]);
    res.json({ success: true, message: "Product deleted" });
}
