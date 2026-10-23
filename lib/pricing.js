import { ObjectId } from "mongodb";
import { z } from "zod";
import { env } from "../config/env.js";
import { HttpError, isObjectId, round2, toCents } from "./http.js";

export const cartItemSchema = z.object({
    productId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid product ID"),
    quantity: z.number().int().min(1).max(99),
    variant: z
        .object({
            size: z.string().trim().max(30).optional(),
            color: z.string().trim().max(30).optional(),
        })
        .optional(),
});

export const quoteSchema = z.object({
    items: z.array(cartItemSchema).max(50),
    couponCode: z.string().trim().max(40).optional().or(z.literal("")),
});

function mergeItems(items) {
    // Same product + same variant collapses into one line.
    const map = new Map();
    for (const item of items) {
        const key = `${item.productId}|${item.variant?.size || ""}|${item.variant?.color || ""}`;
        const existing = map.get(key);
        if (existing) existing.quantity = Math.min(99, existing.quantity + item.quantity);
        else map.set(key, { ...item });
    }
    return [...map.values()];
}

export async function findCoupon(db, code, subtotalCents) {
    const normalized = String(code || "").trim().toUpperCase();
    if (!normalized) return { coupon: null };

    const coupon = await db.collection("coupons").findOne({ code: normalized });
    let error = null;

    if (!coupon || !coupon.active) error = "This coupon code is not valid.";
    else if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) error = "This coupon has expired.";
    else if (coupon.maxUses && (coupon.usedCount || 0) >= coupon.maxUses) error = "This coupon has reached its usage limit.";
    else if (coupon.minSubtotal && subtotalCents < toCents(coupon.minSubtotal)) {
        error = `Spend at least $${Number(coupon.minSubtotal).toFixed(2)} to use this coupon.`;
    }

    return error ? { coupon: null, error } : { coupon };
}

/**
 * Single source of truth for prices. Never trusts anything but productId/quantity from the client.
 * strict=true (checkout) throws on missing / out of stock products or an invalid coupon.
 */
export async function computeQuote(db, rawItems, couponCode, { strict = false } = {}) {
    const items = mergeItems(rawItems);
    const ids = items.filter((i) => isObjectId(i.productId)).map((i) => new ObjectId(i.productId));
    const products = await db
        .collection("products")
        .find({ _id: { $in: ids } })
        .toArray();
    const byId = new Map(products.map((p) => [String(p._id), p]));

    const lines = [];
    for (const item of items) {
        const product = byId.get(item.productId);
        const unavailable = !product || product.status === "draft";
        const stock = product?.stock ?? 0;

        if (strict) {
            if (unavailable) throw new HttpError(409, "One of the products in your cart is no longer available.");
            if (stock < item.quantity) {
                throw new HttpError(
                    409,
                    stock === 0
                        ? `"${product.title}" is out of stock.`
                        : `Only ${stock} left of "${product.title}". Please reduce the quantity.`
                );
            }
            if (product.colors?.length && item.variant?.color && !product.colors.includes(item.variant.color)) {
                throw new HttpError(400, `Invalid colour for "${product.title}".`);
            }
            if (product.sizes?.length && item.variant?.size && !product.sizes.includes(item.variant.size)) {
                throw new HttpError(400, `Invalid size for "${product.title}".`);
            }
        }

        const unitCents = product ? toCents(product.price) : 0;
        lines.push({
            productId: item.productId,
            slug: product?.slug,
            title: product?.title ?? "Unavailable product",
            image: product?.image ?? null,
            category: product?.category,
            variant: item.variant || null,
            quantity: item.quantity,
            unitPrice: unitCents / 100,
            unitCents,
            lineTotal: (unitCents * item.quantity) / 100,
            stock,
            available: !unavailable && stock >= item.quantity,
            unavailable,
        });
    }

    const payable = lines.filter((l) => !l.unavailable);
    const subtotalCents = payable.reduce((sum, l) => sum + l.unitCents * l.quantity, 0);

    const { coupon, error: couponError } = await findCoupon(db, couponCode, subtotalCents);
    if (strict && couponError) throw new HttpError(400, couponError);

    let discountCents = 0;
    if (coupon) {
        discountCents =
            coupon.type === "percent"
                ? Math.round((subtotalCents * coupon.value) / 100)
                : Math.min(toCents(coupon.value), subtotalCents);
    }

    const discountedCents = subtotalCents - discountCents;
    const shippingCents =
        payable.length === 0 || discountedCents / 100 >= env.freeShippingOver ? 0 : toCents(env.shippingFlat);
    const taxCents = Math.round(discountedCents * env.taxRate);
    const totalCents = discountedCents + shippingCents + taxCents;

    return {
        lines,
        currency: env.currency,
        coupon: coupon ? { code: coupon.code, type: coupon.type, value: coupon.value } : null,
        couponError: couponError || null,
        subtotal: subtotalCents / 100,
        discount: discountCents / 100,
        shipping: shippingCents / 100,
        tax: taxCents / 100,
        total: totalCents / 100,
        totalCents,
        subtotalCents,
        discountCents,
        shippingCents,
        taxCents,
        freeShippingOver: env.freeShippingOver,
        taxRate: env.taxRate,
        itemCount: payable.reduce((n, l) => n + l.quantity, 0),
        round2,
    };
}

export function publicQuote(quote) {
    // eslint-disable-next-line no-unused-vars
    const { round2: _r, totalCents, subtotalCents, discountCents, shippingCents, taxCents, ...rest } = quote;
    return {
        ...rest,
        lines: rest.lines.map(({ unitCents, ...line }) => line), // eslint-disable-line no-unused-vars
    };
}
