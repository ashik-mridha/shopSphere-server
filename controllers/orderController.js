import { z } from "zod";
import { HttpError, col, escapeRegex, isObjectId, pageMeta, parsePagination, toObjectId } from "../lib/http.js";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "../lib/orders.js";
import { getStripe, isStripeConfigured } from "../lib/stripe.js";

export const orderStatusSchema = z.object({
    status: z.enum(["processing", "shipped", "delivered", "cancelled"]),
    note: z.string().trim().max(200).optional(),
});

function orderLookup(idOrNumber) {
    return isObjectId(idOrNumber) ? { _id: toObjectId(idOrNumber) } : { orderNumber: String(idOrNumber).toUpperCase() };
}

function listFilter(query, base = {}) {
    const filter = { legacy: { $ne: true }, ...base };
    if (ORDER_STATUSES.includes(query.status)) filter.status = query.status;
    if (PAYMENT_STATUSES.includes(query.paymentStatus)) filter.paymentStatus = query.paymentStatus;
    if (typeof query.q === "string" && query.q.trim()) {
        const rx = new RegExp(escapeRegex(query.q.trim().slice(0, 100)), "i");
        filter.$or = [{ orderNumber: rx }, { "customer.name": rx }, { "customer.email": rx }, { "items.title": rx }];
    }
    return filter;
}

const ORDER_SORTS = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    "total-desc": { total: -1 },
    "total-asc": { total: 1 },
};

async function paged(req, res, filter) {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 50 });
    const orders = col(req, "orders");
    const [items, total] = await Promise.all([
        orders.find(filter).sort(ORDER_SORTS[req.query.sort] || ORDER_SORTS.newest).skip(skip).limit(limit).toArray(),
        orders.countDocuments(filter),
    ]);
    res.json({ success: true, data: items, pagination: pageMeta(total, page, limit) });
}

export const getMyOrders = (req, res) => paged(req, res, listFilter(req.query, { userId: req.user.id }));
export const getAdminOrders = (req, res) => paged(req, res, listFilter(req.query));

export async function getOrder(req, res) {
    const order = await col(req, "orders").findOne(orderLookup(req.params.id));
    // 404 (not 403) for other people's orders so ids cannot be probed
    if (!order || (order.userId !== req.user.id && req.user.role !== "admin")) {
        throw new HttpError(404, "Order not found");
    }
    res.json({ success: true, data: order });
}

export async function cancelMyOrder(req, res) {
    const orders = col(req, "orders");
    const existing = await orders.findOne({ ...orderLookup(req.params.id), userId: req.user.id });
    if (!existing) throw new HttpError(404, "Order not found");
    if (existing.status !== "pending_payment" || existing.paymentStatus !== "pending") {
        throw new HttpError(409, "Only unpaid orders can be cancelled here. Contact support for paid orders.");
    }

    if (existing.stripeSessionId && isStripeConfigured()) {
        try {
            await getStripe().checkout.sessions.expire(existing.stripeSessionId);
        } catch {
            // session may already be expired/completed; the webhook is the source of truth
        }
    }

    const updated = await orders.findOneAndUpdate(
        { _id: existing._id, paymentStatus: "pending" },
        {
            $set: { status: "cancelled", paymentStatus: "expired", updatedAt: new Date() },
            $push: { timeline: { status: "cancelled", note: "Cancelled by customer", at: new Date() } },
        },
        { returnDocument: "after" }
    );
    if (!updated) throw new HttpError(409, "This order was just paid and can no longer be cancelled.");
    res.json({ success: true, message: "Order cancelled", data: updated });
}

export async function updateOrderStatus(req, res) {
    const orders = col(req, "orders");
    const { status, note } = req.valid.body;
    const order = await orders.findOne(orderLookup(req.params.id));
    if (!order) throw new HttpError(404, "Order not found");

    if (order.paymentStatus !== "paid") {
        throw new HttpError(409, "Only paid orders can be moved forward. Wait for the payment to complete.");
    }
    if (status === "cancelled") {
        throw new HttpError(409, "Paid orders are cancelled by issuing a refund (it restocks the items).");
    }
    if (order.status === "cancelled") throw new HttpError(409, "This order is already cancelled.");

    const updated = await orders.findOneAndUpdate(
        { _id: order._id },
        {
            $set: { status, updatedAt: new Date(), ...(status === "delivered" && { deliveredAt: new Date() }) },
            $push: { timeline: { status, note: note || `Order marked as ${status}`, at: new Date() } },
        },
        { returnDocument: "after" }
    );
    res.json({ success: true, message: "Order status updated", data: updated });
}
