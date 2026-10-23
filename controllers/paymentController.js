import { ObjectId } from "mongodb";
import { z } from "zod";
import { env } from "../config/env.js";
import { HttpError, col, toObjectId, toCents } from "../lib/http.js";
import { computeQuote, cartItemSchema } from "../lib/pricing.js";
import { addressSchema } from "./addressController.js";
import { fulfillOrder, generateOrderNumber, markExpired, markPaymentFailed, markRefunded } from "../lib/orders.js";
import { getStripe } from "../lib/stripe.js";

export const checkoutSchema = z.object({
    items: z.array(cartItemSchema).min(1, "Your cart is empty").max(50),
    couponCode: z.string().trim().max(40).optional().or(z.literal("")),
    shippingAddress: addressSchema.pick({
        fullName: true,
        phone: true,
        line1: true,
        line2: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
    }),
});

export const refundSchema = z.object({ reason: z.string().trim().max(200).optional() });

// POST /api/payments/create-checkout-session
export async function createCheckoutSession(req, res) {
    const stripe = getStripe();
    const db = req.app.locals.db;
    const { items, couponCode, shippingAddress } = req.valid.body;

    // Prices, stock and coupon are all resolved from MongoDB, never from the request.
    const quote = await computeQuote(db, items, couponCode, { strict: true });

    const orderDoc = {
        orderNumber: generateOrderNumber(),
        userId: req.user.id,
        customer: { name: shippingAddress.fullName, email: req.user.email, phone: shippingAddress.phone },
        items: quote.lines.map((l) => ({
            productId: new ObjectId(l.productId),
            title: l.title,
            image: l.image,
            variant: l.variant,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            lineTotal: l.lineTotal,
        })),
        subtotal: quote.subtotal,
        discount: quote.discount,
        couponCode: quote.coupon?.code || null,
        shipping: quote.shipping,
        tax: quote.tax,
        total: quote.total,
        currency: quote.currency,
        shippingAddress,
        paymentMethod: "stripe",
        paymentStatus: "pending",
        status: "pending_payment",
        timeline: [{ status: "pending_payment", note: "Order created, waiting for payment", at: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const { insertedId } = await db.collection("orders").insertOne(orderDoc);
    const orderId = String(insertedId);

    try {
        const line_items = quote.lines.map((l) => ({
            quantity: l.quantity,
            price_data: {
                currency: quote.currency,
                unit_amount: l.unitCents,
                product_data: {
                    name: l.title,
                    ...(l.variant && (l.variant.size || l.variant.color) && {
                        description: [l.variant.color, l.variant.size].filter(Boolean).join(" / "),
                    }),
                    // Stripe must be able to fetch the image, so only absolute https URLs are sent.
                    ...(l.image?.startsWith("https://") && { images: [l.image] }),
                },
            },
        }));

        if (quote.taxCents > 0) {
            line_items.push({
                quantity: 1,
                price_data: {
                    currency: quote.currency,
                    unit_amount: quote.taxCents,
                    product_data: { name: `Estimated tax (${Math.round(env.taxRate * 100)}%)` },
                },
            });
        }

        const discounts = [];
        if (quote.discountCents > 0) {
            const coupon = await stripe.coupons.create({
                amount_off: quote.discountCents,
                currency: quote.currency,
                duration: "once",
                name: `Coupon ${quote.coupon.code}`,
                max_redemptions: 1,
            });
            discounts.push({ coupon: coupon.id });
        }

        const metadata = { orderId, userId: req.user.id };

        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            line_items,
            ...(discounts.length && { discounts }),
            customer_email: req.user.email,
            client_reference_id: orderId,
            metadata,
            payment_intent_data: {
                metadata,
                shipping: {
                    name: shippingAddress.fullName,
                    phone: shippingAddress.phone,
                    address: {
                        line1: shippingAddress.line1,
                        line2: shippingAddress.line2 || undefined,
                        city: shippingAddress.city,
                        state: shippingAddress.state,
                        postal_code: shippingAddress.postalCode,
                        country: shippingAddress.country,
                    },
                },
            },
            shipping_options: [
                {
                    shipping_rate_data: {
                        type: "fixed_amount",
                        display_name: quote.shippingCents === 0 ? "Free shipping" : "Standard shipping (3-7 business days)",
                        fixed_amount: { amount: quote.shippingCents, currency: quote.currency },
                    },
                },
            ],
            expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
            success_url: `${env.clientUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${env.clientUrl}/checkout/cancel?order_id=${orderId}`,
        });

        await db.collection("orders").updateOne({ _id: insertedId }, { $set: { stripeSessionId: session.id } });
        res.status(201).json({ success: true, url: session.url, sessionId: session.id, orderId });
    } catch (err) {
        // Never leave a dangling "pending" order if Stripe rejected the session.
        await db.collection("orders").deleteOne({ _id: insertedId });
        if (err?.type?.startsWith("Stripe")) {
            console.error("Stripe session error:", err.message);
            throw new HttpError(502, "We could not start the payment. Please try again.");
        }
        throw err;
    }
}

// GET /api/payments/session/:id – owner only
export async function getSessionStatus(req, res) {
    const db = req.app.locals.db;
    const sessionId = req.params.id;
    if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) throw new HttpError(400, "Invalid session ID");

    let order = await db.collection("orders").findOne({ stripeSessionId: sessionId, userId: req.user.id });
    if (!order) throw new HttpError(404, "Order not found for this payment session");

    // Ask Stripe directly so the page is correct even if the webhook is delayed (or not forwarded in local dev).
    if (order.paymentStatus === "pending") {
        const session = await getStripe().checkout.sessions.retrieve(sessionId);
        if (session.payment_status === "paid") {
            const result = await fulfillOrder(db, order._id, {
                paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
                amountTotal: session.amount_total,
                currency: session.currency,
            });
            order = result.order || order;
        } else if (session.status === "expired") {
            await markExpired(db, order._id);
            order = await db.collection("orders").findOne({ _id: order._id });
        }
    }

    res.json({ success: true, data: order });
}

// POST /api/payments/webhook (raw body – mounted in app.js before express.json)
export async function handleWebhook(req, res) {
    if (!env.stripeSecretKey || !env.stripeWebhookSecret) {
        return res.status(503).json({ success: false, message: "Webhook is not configured." });
    }

    let event;
    try {
        event = getStripe().webhooks.constructEvent(req.body, req.headers["stripe-signature"], env.stripeWebhookSecret);
    } catch (err) {
        console.warn("Stripe webhook signature verification failed:", err.message);
        return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    const db = req.app.locals.db;
    const events = db.collection("processed_events");

    try {
        await events.insertOne({ eventId: event.id, type: event.type, createdAt: new Date() });
    } catch (err) {
        if (err.code === 11000) return res.json({ received: true, duplicate: true });
        throw err;
    }

    try {
        await processEvent(db, event);
        res.json({ received: true });
    } catch (err) {
        // let Stripe retry: forget that we saw this event
        await events.deleteOne({ eventId: event.id });
        throw err;
    }
}

async function processEvent(db, event) {
    const object = event.data.object;
    const orderId = object.metadata?.orderId;
    const validOrderId = orderId && ObjectId.isValid(orderId) ? orderId : null;

    switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded":
            if (validOrderId && object.payment_status === "paid") {
                await fulfillOrder(db, validOrderId, {
                    paymentIntentId: typeof object.payment_intent === "string" ? object.payment_intent : object.payment_intent?.id,
                    amountTotal: object.amount_total,
                    currency: object.currency,
                });
            }
            break;

        case "checkout.session.expired":
            if (validOrderId) await markExpired(db, validOrderId);
            break;

        case "checkout.session.async_payment_failed":
            if (validOrderId) await markPaymentFailed(db, { _id: new ObjectId(validOrderId) });
            break;

        case "payment_intent.payment_failed":
            if (validOrderId) {
                await markPaymentFailed(
                    db,
                    { _id: new ObjectId(validOrderId) },
                    object.last_payment_error?.message || "Payment failed"
                );
            }
            break;

        case "charge.refunded":
            if (object.payment_intent) {
                await markRefunded(db, { paymentIntentId: object.payment_intent }, { note: "Payment refunded via Stripe" });
            }
            break;

        default:
            break;
    }
}

// POST /api/payments/:orderId/refund – admin
export async function refundOrder(req, res) {
    const db = req.app.locals.db;
    const _id = toObjectId(req.params.orderId, "order ID");
    const order = await db.collection("orders").findOne({ _id });
    if (!order) throw new HttpError(404, "Order not found");
    if (order.seeded) throw new HttpError(409, "This is a seeded demo order with no real Stripe payment to refund.");
    if (order.paymentStatus === "refunded") throw new HttpError(409, "This order is already refunded.");
    if (order.paymentStatus !== "paid" || !order.paymentIntentId) {
        throw new HttpError(409, "Only paid Stripe orders can be refunded.");
    }

    const refund = await getStripe().refunds.create(
        {
            payment_intent: order.paymentIntentId,
            amount: toCents(order.total),
            reason: "requested_by_customer",
            metadata: { orderId: String(_id), note: req.valid.body.reason || "" },
        },
        { idempotencyKey: `refund_${_id}` }
    );

    const updated = await markRefunded(db, { _id }, {
        refundId: refund.id,
        note: req.valid.body.reason ? `Refunded: ${req.valid.body.reason}` : "Refunded by admin",
    });

    res.json({
        success: true,
        message: "Refund issued",
        data: updated || (await db.collection("orders").findOne({ _id })),
    });
}
