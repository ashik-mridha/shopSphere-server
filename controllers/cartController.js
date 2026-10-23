import { computeQuote, publicQuote } from "../lib/pricing.js";
import { col } from "../lib/http.js";

// POST /api/cart/quote – prices a cart on the server (used by the cart page and the checkout summary)
export async function quoteCart(req, res) {
    const { items, couponCode } = req.valid.body;
    const quote = await computeQuote(req.app.locals.db, items, couponCode, { strict: false });
    res.json({ success: true, data: publicQuote(quote) });
}

// GET /api/coupons/public – promotions that may be advertised on the storefront
export async function getPublicCoupons(req, res) {
    const now = new Date();
    const coupons = await col(req, "coupons")
        .find({
            active: true,
            public: true,
            $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
        })
        .project({ code: 1, type: 1, value: 1, minSubtotal: 1, description: 1, expiresAt: 1 })
        .toArray();
    res.json({ success: true, data: coupons });
}
