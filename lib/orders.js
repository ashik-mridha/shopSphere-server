import { randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";

export const ORDER_STATUSES = ["pending_payment", "processing", "shipped", "delivered", "cancelled"];
export const PAYMENT_STATUSES = ["pending", "paid", "failed", "expired", "refunded"];

export function generateOrderNumber() {
    return `SS-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function addBusinessDays(date, days) {
    const d = new Date(date);
    let added = 0;
    while (added < days) {
        d.setDate(d.getDate() + 1);
        if (d.getDay() !== 0 && d.getDay() !== 6) added += 1;
    }
    return d;
}

export function estimateDelivery(from = new Date()) {
    return { from: addBusinessDays(from, 3), to: addBusinessDays(from, 7) };
}

const timelineEntry = (status, note) => ({ status, note, at: new Date() });

/**
 * Marks an order paid exactly once. Safe to call from the webhook AND from the
 * session-verify endpoint, and safe to call repeatedly for the same Stripe event.
 */
export async function fulfillOrder(db, orderId, { paymentIntentId, amountTotal, currency } = {}) {
    const orders = db.collection("orders");
    const _id = typeof orderId === "string" ? new ObjectId(orderId) : orderId;

    const order = await orders.findOne({ _id });
    if (!order) return { order: null, changed: false };

    const mismatch =
        amountTotal != null &&
        (amountTotal !== Math.round(order.total * 100) || (currency && currency.toLowerCase() !== order.currency));

    const updated = await orders.findOneAndUpdate(
        { _id, paymentStatus: { $in: ["pending", "failed"] } },
        {
            $set: {
                paymentStatus: "paid",
                status: "processing",
                paidAt: new Date(),
                updatedAt: new Date(),
                estimatedDelivery: estimateDelivery(),
                ...(paymentIntentId && { paymentIntentId }),
                ...(mismatch && { needsReview: true }),
            },
            $push: { timeline: timelineEntry("processing", "Payment received") },
        },
        { returnDocument: "after" }
    );

    // Another call already completed this order (duplicate event / verify + webhook race).
    if (!updated) return { order: await orders.findOne({ _id }), changed: false };

    const products = db.collection("products");
    let stockIssue = false;
    for (const item of updated.items) {
        const before = await products.findOneAndUpdate(
            { _id: item.productId },
            [
                {
                    $set: {
                        stock: { $max: [0, { $subtract: [{ $ifNull: ["$stock", 0] }, item.quantity] }] },
                        sold: { $add: [{ $ifNull: ["$sold", 0] }, item.quantity] },
                    },
                },
            ],
            { returnDocument: "before", projection: { stock: 1 } }
        );
        if (before && (before.stock ?? 0) < item.quantity) stockIssue = true;
    }

    if (stockIssue) await orders.updateOne({ _id }, { $set: { stockIssue: true } });

    if (updated.couponCode) {
        await db.collection("coupons").updateOne({ code: updated.couponCode }, { $inc: { usedCount: 1 } });
    }

    return { order: { ...updated, ...(stockIssue && { stockIssue }) }, changed: true };
}

export async function markExpired(db, orderId) {
    const _id = new ObjectId(orderId);
    return db.collection("orders").updateOne(
        { _id, paymentStatus: "pending" },
        {
            $set: { paymentStatus: "expired", status: "cancelled", updatedAt: new Date() },
            $push: { timeline: timelineEntry("cancelled", "Checkout session expired") },
        }
    );
}

export async function markPaymentFailed(db, filter, note = "Payment failed") {
    return db.collection("orders").updateOne(
        { ...filter, paymentStatus: "pending" },
        {
            $set: { paymentStatus: "failed", updatedAt: new Date() },
            $push: { timeline: timelineEntry("pending_payment", note) },
        }
    );
}

/** Idempotent: only the call that flips paid -> refunded restocks. */
export async function markRefunded(db, filter, { refundId, note = "Payment refunded" } = {}) {
    const orders = db.collection("orders");
    const updated = await orders.findOneAndUpdate(
        { ...filter, paymentStatus: "paid" },
        {
            $set: {
                paymentStatus: "refunded",
                status: "cancelled",
                refundedAt: new Date(),
                updatedAt: new Date(),
                ...(refundId && { refundId }),
            },
            $push: { timeline: timelineEntry("cancelled", note) },
        },
        { returnDocument: "after" }
    );

    if (updated) {
        const products = db.collection("products");
        for (const item of updated.items) {
            await products.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity, sold: -item.quantity } });
        }
    }
    return updated;
}
