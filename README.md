# ShopSphere API

Express 5 + MongoDB + Better Auth + Stripe Checkout (test mode).

## Quick start

```bash
npm install
cp .env.example .env      # fill in MONGODB_URI, BETTER_AUTH_SECRET, Stripe test keys
npm run seed              # idempotent: categories, 24 products, coupons, FAQs, demo users, demo orders & reviews
npm run dev               # http://localhost:5000
```

`GET /api/health` should answer `MongoDB connected`.

### Demo accounts (created by `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@shopsphere.demo` | `Admin@12345` (override with `SEED_ADMIN_PASSWORD`) |
| Customer | `user@shopsphere.demo` | `Demo@12345` (override with `SEED_DEMO_PASSWORD`) |

Change or delete these accounts before exposing the app publicly.

Coupons seeded: `WELCOME10` (10% off over $30), `SAVE15` ($15 off over $100).

Records from the old single-product version (products without a `slug`, orders without an `orderNumber`) are **not deleted**; the seed marks them `legacy` so they are hidden from the storefront and the admin order list.

## Stripe (test mode only)

1. Create a Stripe account and copy the **test** secret key (`sk_test_...`) into `STRIPE_SECRET_KEY`. Live keys (`sk_live_...`) are refused at startup.
2. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and forward webhooks to your local API:

   ```bash
   stripe login
   stripe listen --forward-to localhost:5000/api/payments/webhook
   ```

   The CLI prints a signing secret (`whsec_...`): put it in `STRIPE_WEBHOOK_SECRET` and restart the server. Use your `PORT` if it is not 5000.
3. Pay with the test card **4242 4242 4242 4242**, any future expiry, any CVC, any postal code. Other useful cards: `4000 0000 0000 0002` (declined), `4000 0025 0000 3155` (3-D Secure).

### How a payment flows

1. `POST /api/payments/create-checkout-session` (login required). The client sends only product ids, quantities, variant, coupon code and the shipping address. **Prices, stock and the coupon are looked up in MongoDB**; the client price is never used.
2. A `pending_payment` order (`paymentStatus: pending`) is created, then a Stripe Checkout Session (line items, shipping option, tax line, discount, `metadata.orderId`) is returned as a redirect URL. The shipping address collected by our form is attached to the PaymentIntent.
3. Stripe calls `POST /api/payments/webhook`. The raw body is mounted **before** `express.json()` (see `app.js`) so the signature can be verified. Handled events: `checkout.session.completed`, `checkout.session.async_payment_succeeded/failed`, `checkout.session.expired`, `payment_intent.payment_failed`, `charge.refunded`.
4. On success the order becomes `paymentStatus: paid`, `status: processing`, stock is decremented and the coupon use is counted. This is **idempotent**: each Stripe event id is stored once (`processed_events`) and the order update is conditional, so a replayed event never double-decrements stock.
5. `GET /api/payments/session/:id` (owner only) re-checks the session with Stripe, so the success page is correct even if the webhook is late (or you forgot `stripe listen`).
6. `POST /api/payments/:orderId/refund` (admin) refunds through Stripe, marks the order refunded/cancelled and restocks.

Without Stripe keys the payment endpoints answer a clear `503`; the rest of the API works.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | nodemon |
| `npm start` | production start |
| `npm run seed` | idempotent seed (also writes product images into `../shopSphere/public/products`) |

## API overview

Lists return `{ success, data: [...], pagination: { total, page, limit, pages } }`, single resources `{ success, data }`, errors `{ success: false, message }`.

| Area | Endpoints |
|---|---|
| Catalogue (public) | `GET /api/products` (q, category, brand, minPrice, maxPrice, rating, sort, onSale, isNew, featured, inStock, page, limit) · `/products/meta/filters` · `/products/:idOrSlug` · `/products/:idOrSlug/related` · `GET/POST /products/:idOrSlug/reviews` · `/categories` · `/faqs` · `/coupons/public` · `/reviews/featured` · `/stats/public` |
| Cart | `POST /api/cart/quote` (server-side pricing, coupon, shipping, tax) |
| Customer (login) | `/wishlist` (GET, POST/DELETE `/:productId`) · `/addresses` CRUD · `/orders`, `/orders/:id`, `POST /orders/:id/cancel` |
| Forms (rate limited) | `POST /api/contact` · `POST /api/newsletter` |
| Payments | `POST /api/payments/create-checkout-session` · `GET /api/payments/session/:id` · `POST /api/payments/webhook` · `POST /api/payments/:orderId/refund` (admin) |
| Admin (`/api/admin`) | `stats` · `products` CRUD · `categories` · `orders` (+ `/:id/status`) · `users` (role, block) · `coupons` · `messages` · `reviews` |
| Auth | Better Auth under `/api/auth/*` (email + password, Google, admin plugin) |

Order lifecycle: `status` = `pending_payment → processing → shipped → delivered` (or `cancelled`); `paymentStatus` = `pending | paid | failed | expired | refunded`.

## Security notes

- helmet, CORS limited to `CLIENT_URL`, rate limits on `/api/auth`, payments and public forms, zod validation on every write route, centralized error handler.
- Admin routes use `requireAdmin`; customers only ever see their own orders/addresses/wishlist.
- Blocking a user deletes their sessions immediately.
- No transactional email is sent by this project.
