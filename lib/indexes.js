export async function ensureIndexes(db) {
    await Promise.all([
        db.collection("products").createIndex({ slug: 1 }, { unique: true, sparse: true }),
        db.collection("products").createIndex({ category: 1, price: 1 }),
        db.collection("products").createIndex({ title: "text", description: "text", brand: "text" }),
        db.collection("categories").createIndex({ slug: 1 }, { unique: true }),
        db.collection("orders").createIndex({ userId: 1, createdAt: -1 }),
        db.collection("orders").createIndex({ stripeSessionId: 1 }, { sparse: true }),
        db.collection("orders").createIndex({ orderNumber: 1 }, { unique: true, sparse: true }),
        db.collection("processed_events").createIndex({ eventId: 1 }, { unique: true }),
        db.collection("processed_events").createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }),
        db.collection("coupons").createIndex({ code: 1 }, { unique: true }),
        db.collection("reviews").createIndex({ productId: 1, userId: 1 }, { unique: true }),
        db.collection("wishlists").createIndex({ userId: 1 }, { unique: true }),
        db.collection("addresses").createIndex({ userId: 1 }),
        db.collection("newsletter").createIndex({ email: 1 }, { unique: true }),
    ]);
}
