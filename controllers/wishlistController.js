import { HttpError, col, toObjectId } from "../lib/http.js";

export async function getWishlist(req, res) {
    const doc = await col(req, "wishlists").findOne({ userId: req.user.id });
    const ids = doc?.productIds || [];
    const products = ids.length ? await col(req, "products").find({ _id: { $in: ids } }).toArray() : [];
    // keep most recently added first
    const order = new Map(ids.map((id, i) => [String(id), i]));
    products.sort((a, b) => order.get(String(b._id)) - order.get(String(a._id)));

    res.json({ success: true, data: products, ids: ids.map(String) });
}

export async function addToWishlist(req, res) {
    const productId = toObjectId(req.params.productId, "product ID");
    const exists = await col(req, "products").findOne({ _id: productId }, { projection: { _id: 1 } });
    if (!exists) throw new HttpError(404, "Product not found");

    await col(req, "wishlists").updateOne(
        { userId: req.user.id },
        { $addToSet: { productIds: productId }, $set: { updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true }
    );
    res.status(201).json({ success: true, message: "Added to wishlist" });
}

export async function removeFromWishlist(req, res) {
    const productId = toObjectId(req.params.productId, "product ID");
    await col(req, "wishlists").updateOne(
        { userId: req.user.id },
        { $pull: { productIds: productId }, $set: { updatedAt: new Date() } }
    );
    res.json({ success: true, message: "Removed from wishlist" });
}
