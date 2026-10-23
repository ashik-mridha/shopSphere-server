import { col } from "../lib/http.js";

const LIVE = { legacy: { $ne: true } }; // ignore records from the old single-product app
const PAID = { paymentStatus: "paid", ...LIVE };

export async function getPublicStats(req, res) {
    const db = req.app.locals.db;
    const [products, categories, customers, reviews, ratingAgg, delivered] = await Promise.all([
        db.collection("products").countDocuments({ status: { $ne: "draft" } }),
        db.collection("categories").countDocuments({}),
        db.collection("user").countDocuments({}),
        db.collection("reviews").countDocuments({ status: "approved" }),
        db.collection("reviews").aggregate([{ $match: { status: "approved" } }, { $group: { _id: null, avg: { $avg: "$rating" } } }]).toArray(),
        db.collection("orders").countDocuments({ status: "delivered", ...LIVE }),
    ]);
    res.json({
        success: true,
        data: {
            products,
            categories,
            customers,
            reviews,
            deliveredOrders: delivered,
            averageRating: ratingAgg[0] ? Math.round(ratingAgg[0].avg * 10) / 10 : 0,
        },
    });
}

export async function getAdminStats(req, res) {
    const orders = col(req, "orders");
    const days = 30;
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const [totals, byDay, byStatus, byCategory, topProducts, recentOrders, counts] = await Promise.all([
        orders.aggregate([{ $match: PAID }, { $group: { _id: null, revenue: { $sum: "$total" }, orders: { $sum: 1 } } }]).toArray(),
        orders
            .aggregate([
                { $match: { ...PAID, paidAt: { $gte: since } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } }, revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
            ])
            .toArray(),
        orders.aggregate([{ $match: LIVE }, { $group: { _id: "$status", count: { $sum: 1 } } }]).toArray(),
        orders
            .aggregate([
                { $match: PAID },
                { $unwind: "$items" },
                { $lookup: { from: "products", localField: "items.productId", foreignField: "_id", as: "p" } },
                { $unwind: { path: "$p", preserveNullAndEmptyArrays: true } },
                { $group: { _id: { $ifNull: ["$p.category", "other"] }, revenue: { $sum: "$items.lineTotal" }, units: { $sum: "$items.quantity" } } },
                { $sort: { revenue: -1 } },
            ])
            .toArray(),
        orders
            .aggregate([
                { $match: PAID },
                { $unwind: "$items" },
                { $group: { _id: "$items.productId", title: { $first: "$items.title" }, image: { $first: "$items.image" }, units: { $sum: "$items.quantity" }, revenue: { $sum: "$items.lineTotal" } } },
                { $sort: { units: -1 } },
                { $limit: 5 },
            ])
            .toArray(),
        orders.find(LIVE).sort({ createdAt: -1 }).limit(6).project({ orderNumber: 1, customer: 1, total: 1, status: 1, paymentStatus: 1, createdAt: 1 }).toArray(),
        Promise.all([
            col(req, "user").countDocuments({}),
            col(req, "products").countDocuments(LIVE),
            col(req, "products").countDocuments({ stock: { $lte: 5 }, ...LIVE }),
            col(req, "messages").countDocuments({ status: "new" }),
            orders.countDocuments({ status: "processing", ...LIVE }),
            col(req, "reviews").countDocuments({}),
        ]),
    ]);

    // fill missing days so the chart has a continuous x-axis
    const dayMap = new Map(byDay.map((d) => [d._id, d]));
    const series = [];
    for (let i = 0; i < days; i += 1) {
        const d = new Date(since);
        d.setDate(since.getDate() + i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const hit = dayMap.get(key);
        series.push({ date: key, revenue: hit ? Math.round(hit.revenue * 100) / 100 : 0, orders: hit?.orders || 0 });
    }

    const [users, productCount, lowStock, newMessages, toFulfil, reviewCount] = counts;

    res.json({
        success: true,
        data: {
            cards: {
                revenue: Math.round((totals[0]?.revenue || 0) * 100) / 100,
                paidOrders: totals[0]?.orders || 0,
                users,
                products: productCount,
                lowStock,
                newMessages,
                toFulfil,
                reviews: reviewCount,
            },
            revenueByDay: series,
            ordersByStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
            salesByCategory: byCategory.map((c) => ({ category: c._id, revenue: Math.round(c.revenue * 100) / 100, units: c.units })),
            topProducts,
            recentOrders,
        },
    });
}
