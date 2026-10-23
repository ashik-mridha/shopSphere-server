import { z } from "zod";
import { HttpError, col, slugify, toObjectId } from "../lib/http.js";

export const categorySchema = z.object({
    name: z.string().trim().min(2).max(60),
    description: z.string().trim().max(300).optional().default(""),
    image: z.string().trim().max(500).optional().default(""),
});

export async function getCategories(req, res) {
    const [categories, counts] = await Promise.all([
        col(req, "categories").find({}).sort({ name: 1 }).toArray(),
        col(req, "products")
            .aggregate([{ $match: { status: { $ne: "draft" } } }, { $group: { _id: "$category", count: { $sum: 1 } } }])
            .toArray(),
    ]);
    const countBySlug = new Map(counts.map((c) => [c._id, c.count]));
    res.json({
        success: true,
        data: categories.map((c) => ({ ...c, productCount: countBySlug.get(c.slug) || 0 })),
    });
}

export async function createCategory(req, res) {
    const body = req.valid.body;
    const slug = slugify(body.name);
    if (!slug) throw new HttpError(400, "Category name is invalid.");

    const doc = { ...body, slug, createdAt: new Date() };
    const result = await col(req, "categories").insertOne(doc);
    res.status(201).json({ success: true, message: "Category created", data: { ...doc, _id: result.insertedId } });
}

export async function updateCategory(req, res) {
    const _id = toObjectId(req.params.id, "category ID");
    const updated = await col(req, "categories").findOneAndUpdate(
        { _id },
        { $set: { ...req.valid.body, updatedAt: new Date() } },
        { returnDocument: "after" }
    );
    if (!updated) throw new HttpError(404, "Category not found");
    res.json({ success: true, message: "Category updated", data: updated });
}

export async function deleteCategory(req, res) {
    const _id = toObjectId(req.params.id, "category ID");
    const category = await col(req, "categories").findOne({ _id });
    if (!category) throw new HttpError(404, "Category not found");

    const inUse = await col(req, "products").countDocuments({ category: category.slug });
    if (inUse) throw new HttpError(409, `Cannot delete: ${inUse} product(s) still use this category.`);

    await col(req, "categories").deleteOne({ _id });
    res.json({ success: true, message: "Category deleted" });
}
