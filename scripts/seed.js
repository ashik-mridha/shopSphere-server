// npm run seed  – idempotent: safe to run many times (everything is upserted by a natural key).
import { auth } from "../config/auth.js";
import { connectDB, closeDB } from "../config/database.js";
import { generateProductArt } from "./product-art.js";

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || "Demo@12345";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Admin@12345";

const categories = [
    { slug: "audio", name: "Audio", description: "Headphones, earbuds, speakers and microphones for every listener." },
    { slug: "computers", name: "Computers", description: "Laptops, monitors and the peripherals that go with them." },
    { slug: "smart-home", name: "Smart Home", description: "Lighting, plugs and cameras that make a home easier to run." },
    { slug: "accessories", name: "Accessories", description: "Everyday carry: wallets, bags, watches and eyewear." },
    { slug: "fitness", name: "Fitness", description: "Gear for training at home, outdoors and on the road." },
    { slug: "home-kitchen", name: "Home & Kitchen", description: "Cookware and tableware built for daily use." },
];

// photo: real photograph supplied for that product. art: illustration template (see product-art.js).
const P = (slug, title, category, brand, price, compareAtPrice, stock, description, specs, extra = {}) => ({
    slug, title, category, brand, price, compareAtPrice, stock, description, specs, ...extra,
});

const products = [
    P("aurora-wireless-headphones", "Aurora Wireless Headphones", "audio", "Aurora", 129.99, 169.99, 42,
        "Over-ear Bluetooth headphones with active noise cancellation, deep tuned bass and soft memory-foam ear cushions. Fold flat for travel and get a full day of listening from a single charge.",
        [["Battery life", "40 hours (ANC on)"], ["Connectivity", "Bluetooth 5.3, 3.5 mm cable"], ["Drivers", "40 mm dynamic"], ["Weight", "260 g"]],
        { photo: true, featured: true, sold: 188, colors: ["Magenta", "Black"] }),
    P("pulse-buds-pro-earbuds", "Pulse Buds Pro Earbuds", "audio", "Pulse", 79.99, null, 120,
        "True wireless earbuds with hybrid noise cancellation, a low-latency gaming mode and an IPX5 sweat-resistant build. The compact case adds three extra charges.",
        [["Battery life", "8 h buds + 24 h case"], ["Water resistance", "IPX5"], ["Connectivity", "Bluetooth 5.3"], ["Charging", "USB-C, wireless"]],
        { art: "earbuds", isNew: true, sold: 241, colors: ["Graphite", "Cloud"] }),
    P("nimbus-smart-speaker", "Nimbus Smart Speaker", "audio", "Nimbus", 89, 109, 36,
        "A fabric-wrapped 360-degree smart speaker with room-filling sound, far-field voice control and multi-room sync. Its compact body sits comfortably on a shelf, desk or kitchen counter.",
        [["Output", "30 W, 360-degree"], ["Voice", "Far-field, 4 microphones"], ["Connectivity", "Wi-Fi 6, Bluetooth 5.2"], ["Dimensions", "14 x 14 x 15 cm"]],
        { photo: true, featured: true, sold: 134 }),
    P("studio-condenser-usb-microphone", "Studio Condenser USB Microphone", "audio", "Vocalis", 99, null, 28,
        "Plug-and-play cardioid condenser microphone for podcasts, streaming and remote calls. Includes a desktop stand, pop filter and a mute button with a status light.",
        [["Pickup pattern", "Cardioid"], ["Sample rate", "24-bit / 96 kHz"], ["Connection", "USB-C"], ["Includes", "Stand, pop filter, 2 m cable"]],
        { art: "mic", sold: 76 }),

    P("zenbook-air-14-laptop", "Zenbook Air 14 Laptop", "computers", "Zenbook", 899, 999, 14,
        "A thin 14-inch aluminium laptop for work and study: a bright 2.8K display, fast NVMe storage and a battery that comfortably lasts the working day. Weighs just 1.2 kg.",
        [["Display", "14\" 2.8K IPS, 400 nits"], ["Memory / storage", "16 GB RAM / 512 GB SSD"], ["Battery", "Up to 14 hours"], ["Weight", "1.2 kg"], ["Ports", "2x USB-C (Thunderbolt), USB-A, HDMI"]],
        { photo: true, featured: true, sold: 52 }),
    P("mechanical-keyboard-k8", "Mechanical Keyboard K8", "computers", "Keystone", 69.99, null, 64,
        "Compact 75% hot-swappable mechanical keyboard with tactile switches, PBT keycaps and per-key white backlighting. Connects over Bluetooth to three devices or by USB-C.",
        [["Layout", "75% (84 keys)"], ["Switches", "Hot-swappable tactile"], ["Connectivity", "Bluetooth 5.1 / USB-C"], ["Battery", "4000 mAh"]],
        { art: "keyboard", isNew: true, sold: 98 }),
    P("precision-wireless-mouse", "Precision Wireless Mouse", "computers", "Keystone", 39.99, 49.99, 150,
        "Ergonomic wireless mouse with a 8000 DPI optical sensor, silent clicks and a rechargeable battery that lasts up to 70 days. Pairs with two computers.",
        [["Sensor", "8000 DPI optical"], ["Battery", "Up to 70 days"], ["Connectivity", "2.4 GHz + Bluetooth"], ["Weight", "88 g"]],
        { art: "mouse", sold: 312, colors: ["Slate", "Sky"] }),
    P("4k-ultrasharp-27-monitor", "4K UltraSharp 27\" Monitor", "computers", "Vista", 349, null, 22,
        "A colour-accurate 27-inch 4K IPS monitor covering 99% of sRGB, with a height-adjustable stand, USB-C power delivery and a flicker-free, low-blue-light panel.",
        [["Panel", "27\" 4K IPS, 60 Hz"], ["Colour", "99% sRGB, factory calibrated"], ["Ports", "HDMI 2.0, DisplayPort, USB-C 65 W"], ["Stand", "Height, tilt, swivel"]],
        { art: "monitor", sold: 41 }),

    P("glow-smart-led-bulb-4-pack", "Glow Smart LED Bulb 4-Pack", "smart-home", "Glow", 34.99, 44.99, 200,
        "Wi-Fi colour LED bulbs you control from your phone or by voice. 16 million colours, adjustable white and schedules, with no hub required.",
        [["Brightness", "800 lumens (60 W equivalent)"], ["Colour", "RGB + 2700-6500 K white"], ["Base", "E26 / E27"], ["Connectivity", "Wi-Fi 2.4 GHz"]],
        { art: "bulb", sold: 405 }),
    P("lumen-desk-lamp", "Lumen Desk Lamp", "smart-home", "Lumen", 44.99, null, 58,
        "Dimmable LED desk lamp with a flexible arm, five colour temperatures and a wireless charging base. Eye-care lighting with no visible flicker.",
        [["Light source", "LED, 10 W"], ["Colour temperature", "2700-6500 K"], ["Extras", "10 W Qi charging base"], ["Power", "USB-C / adapter"]],
        { art: "lamp", sold: 87, colors: ["White", "Black"] }),
    P("hub-mini-smart-plug-2-pack", "Hub Mini Smart Plug 2-Pack", "smart-home", "Glow", 24.99, null, 180,
        "Turn any appliance into a smart one. Schedule lamps and fans, track energy use in the app and control them by voice. Compact enough to leave the second outlet free.",
        [["Rating", "15 A / 1800 W"], ["Connectivity", "Wi-Fi 2.4 GHz"], ["Features", "Schedules, timers, energy monitor"], ["Pack", "2 plugs"]],
        { art: "plug", sold: 266 }),
    P("guardian-wifi-security-camera", "Guardian Wi-Fi Security Camera", "smart-home", "Guardian", 59.99, 79.99, 47,
        "1080p indoor security camera with night vision, two-way audio and person detection alerts. Stores clips on a microSD card (up to 256 GB) with no subscription needed.",
        [["Resolution", "1080p, 130-degree view"], ["Night vision", "Up to 10 m"], ["Storage", "microSD (not included)"], ["Audio", "Two-way"]],
        { art: "camera", sold: 119 }),

    P("felt-card-holder-wallet", "Felt Card Holder Wallet", "accessories", "Feltwork", 29, null, 90,
        "A slim wool-felt card holder with contrast stitching. Three card slots and a central pocket for folded notes, in a profile that disappears into a jeans pocket.",
        [["Material", "Wool felt, cotton thread"], ["Capacity", "6-8 cards + notes"], ["Size", "10 x 7.5 cm"], ["Colour", "Charcoal"]],
        { photo: true, sold: 154 }),
    P("metro-everyday-backpack", "Metro Everyday Backpack", "accessories", "Metro", 64.99, null, 70,
        "A water-resistant 22 L backpack with a padded 15-inch laptop sleeve, hidden anti-theft pocket and a trolley strap. Clean enough for the office, tough enough for the commute.",
        [["Capacity", "22 L"], ["Laptop sleeve", "Up to 15\""], ["Material", "Recycled water-resistant polyester"], ["Weight", "0.8 kg"]],
        { art: "backpack", featured: true, sold: 173, colors: ["Navy", "Olive", "Black"] }),
    P("chrono-minimal-watch", "Chrono Minimal Watch", "accessories", "Chrono", 119, 149, 33,
        "A 40 mm stainless-steel quartz watch with a sapphire-coated crystal, 5 ATM water resistance and a soft leather strap. Understated enough to wear every day.",
        [["Case", "40 mm stainless steel"], ["Movement", "Japanese quartz"], ["Water resistance", "5 ATM"], ["Strap", "Genuine leather, 20 mm"]],
        { art: "watch", sold: 64, colors: ["Silver", "Rose gold"] }),
    P("aero-polarized-sunglasses", "Aero Polarized Sunglasses", "accessories", "Aero", 54, null, 85,
        "Lightweight polarised sunglasses with UV400 lenses and a flexible TR90 frame. A hard case and cleaning cloth are included.",
        [["Lens", "Polarised, UV400"], ["Frame", "TR90 nylon"], ["Weight", "24 g"], ["Includes", "Hard case, cloth"]],
        { art: "sunglasses", isNew: true, sold: 92, colors: ["Black", "Tortoise"] }),

    P("flex-pro-yoga-mat", "Flex Pro Yoga Mat", "fitness", "Flexa", 34.99, null, 110,
        "A 6 mm non-slip yoga mat in natural rubber with a grippy top layer that stays put on hardwood and tile. Comes with a carry strap.",
        [["Thickness", "6 mm"], ["Size", "183 x 61 cm"], ["Material", "Natural rubber / PU"], ["Weight", "1.9 kg"]],
        { art: "mat", sold: 207, colors: ["Teal", "Plum", "Slate"] }),
    P("steel-insulated-water-bottle-750ml", "Steel Insulated Water Bottle 750 ml", "fitness", "Flexa", 27.99, null, 240,
        "Double-wall vacuum insulated bottle that keeps drinks cold for 24 hours or hot for 12. BPA-free, leak-proof lid and a powder-coated grip finish.",
        [["Capacity", "750 ml"], ["Insulation", "24 h cold / 12 h hot"], ["Material", "18/8 stainless steel"], ["Fits", "Most car cup holders"]],
        { art: "bottle", sold: 356, colors: ["Forest", "Sand", "Midnight"] }),
    P("adjustable-dumbbell-set", "Adjustable Dumbbell Set", "fitness", "IronCore", 149, 189, 18,
        "Replace a rack of weights with a single pair. Dial from 2.5 kg to 24 kg each in seconds, with a tray that keeps everything stable between sets.",
        [["Range", "2.5-24 kg per dumbbell"], ["Increments", "2.5 kg"], ["Mechanism", "Quick-select dial"], ["Includes", "Storage tray"]],
        { art: "dumbbell", sold: 58 }),
    P("pace-running-shoes", "Pace Running Shoes", "fitness", "Pace", 89.99, null, 96,
        "Breathable knit running shoes with a responsive foam midsole and a durable rubber outsole. A neutral fit for road runs and daily training.",
        [["Upper", "Engineered knit"], ["Midsole", "Responsive EVA foam"], ["Drop", "8 mm"], ["Weight", "260 g (UK 9)"]],
        { art: "shoe", featured: true, sold: 144, sizes: ["7", "8", "9", "10", "11", "12"], colors: ["Coral", "Ink"] }),

    P("brew-master-pour-over-kettle", "Brew Master Pour-Over Kettle", "home-kitchen", "Brewlab", 49.99, null, 54,
        "A 1 L gooseneck kettle for precise pour-over coffee and tea. Stainless steel, with a built-in thermometer and a heat-resistant handle.",
        [["Capacity", "1 L"], ["Spout", "Gooseneck"], ["Material", "304 stainless steel"], ["Compatible", "Gas, electric, induction"]],
        { art: "kettle", sold: 83 }),
    P("ceramic-mug-set-of-4", "Ceramic Mug Set of 4", "home-kitchen", "Hearth", 32, null, 130,
        "Four hand-glazed stoneware mugs, 350 ml each, in a speckled finish. Microwave and dishwasher safe, stackable for tidy cupboards.",
        [["Capacity", "350 ml each"], ["Material", "Glazed stoneware"], ["Care", "Dishwasher and microwave safe"], ["Set", "4 mugs"]],
        { art: "mug", isNew: true, sold: 121 }),
    P("bamboo-cutting-board", "Bamboo Cutting Board", "home-kitchen", "Hearth", 24.99, null, 160,
        "A large reversible bamboo board with a juice groove and a built-in handle. Gentle on knife edges and easy to keep clean.",
        [["Size", "45 x 30 x 2 cm"], ["Material", "Moso bamboo"], ["Features", "Juice groove, reversible"], ["Care", "Hand wash"]],
        { art: "board", sold: 175 }),
    P("compact-air-fryer-4l", "Compact Air Fryer 4 L", "home-kitchen", "Hearth", 99.99, 129.99, 40,
        "A 4-litre air fryer that cooks with up to 90% less oil. Eight one-touch presets, a non-stick dishwasher-safe basket and a quiet fan.",
        [["Capacity", "4 L"], ["Power", "1500 W"], ["Presets", "8 one-touch"], ["Basket", "Non-stick, dishwasher safe"]],
        { art: "airfryer", featured: true, sold: 109 }),
];

const coupons = [
    { code: "WELCOME10", type: "percent", value: 10, minSubtotal: 30, maxUses: 0, active: true, public: true, description: "10% off your first order over $30" },
    { code: "SAVE15", type: "fixed", value: 15, minSubtotal: 100, maxUses: 0, active: true, public: true, description: "$15 off orders over $100" },
    { code: "SUMMER25", type: "percent", value: 25, minSubtotal: 0, maxUses: 50, active: false, public: false, description: "Seasonal sale (currently paused)" },
];

const faqs = [
    ["Orders & payment", "How do I pay?", "We accept all major credit and debit cards through Stripe's secure hosted checkout. Your card details go directly to Stripe and never touch our servers."],
    ["Orders & payment", "Is my payment secure?", "Yes. Payments are processed by Stripe, which is certified to PCI Service Provider Level 1, the highest level in the payments industry."],
    ["Orders & payment", "Can I change or cancel my order?", "You can cancel an unpaid order from My Orders at any time. Once an order is paid and being prepared, please contact us as soon as possible and we will do our best to stop it."],
    ["Orders & payment", "How do coupon codes work?", "Enter your code in the cart. The discount is calculated on the server and shown before you pay. Only one coupon can be used per order."],
    ["Shipping", "How much is shipping and how long does it take?", "Standard shipping is $5.99 and free on orders of $75 or more. Orders usually arrive within 3-7 business days after payment is confirmed."],
    ["Shipping", "How can I track my order?", "Sign in and open My Orders, or visit Track Order and enter your order number. Each order shows its current status and a full timeline."],
    ["Returns", "What is your return policy?", "You can return unused items in their original packaging within 30 days of delivery for a full refund to your original payment method."],
    ["Returns", "When will I get my refund?", "Once we receive and inspect your return, refunds are issued straight away. Your bank typically shows the credit within 5-10 business days."],
    ["Account", "Do I need an account to order?", "Yes. An account lets you track orders, save addresses, keep a wishlist and leave verified reviews. You can sign up with email or Google."],
    ["Account", "Who can write a review?", "Only customers who have bought a product can review it. This keeps every review honest and marks it as a verified purchase."],
];

const customers = [
    ["Amelia Carter", "amelia.carter@shopsphere.demo"],
    ["Daniel Okafor", "daniel.okafor@shopsphere.demo"],
    ["Priya Nair", "priya.nair@shopsphere.demo"],
    ["Lucas Meyer", "lucas.meyer@shopsphere.demo"],
    ["Sofia Alvarez", "sofia.alvarez@shopsphere.demo"],
];

const reviewPool = [
    [5, "Exactly what I hoped for", "Build quality is better than I expected for the price. Arrived quickly and works perfectly out of the box."],
    [5, "Would buy again", "I have used it every day for a month and it still feels brand new. Setup took two minutes."],
    [4, "Great value", "Really solid product. Knocked one star off only because the packaging was a bit oversized."],
    [4, "Very happy", "Does what it says. Looks great, feels premium and the instructions were clear."],
    [5, "Better than the more expensive one", "I compared this with a pricier brand and honestly prefer this one. Highly recommended."],
    [3, "Good, not perfect", "Works well overall but I would have liked a little more polish on the finish. Still a fair price."],
];

const addresses = [
    ["Amelia Carter", "+1 415 555 0134", "221 Market Street", "Apt 4B", "San Francisco", "CA", "94105", "US"],
    ["Daniel Okafor", "+1 312 555 0178", "88 W Randolph Street", "", "Chicago", "IL", "60601", "US"],
    ["Priya Nair", "+1 512 555 0199", "1200 Congress Avenue", "Suite 300", "Austin", "TX", "78701", "US"],
    ["Lucas Meyer", "+1 206 555 0112", "410 Pine Street", "", "Seattle", "WA", "98101", "US"],
    ["Sofia Alvarez", "+1 305 555 0166", "75 Brickell Avenue", "Unit 12", "Miami", "FL", "33131", "US"],
    ["Demo Customer", "+1 415 555 0134", "221 Market Street", "Apt 4B", "San Francisco", "CA", "94105", "US"], // demo user (keep last)
];

async function ensureUser(db, { name, email, password, role }) {
    const users = db.collection("user");
    let user = await users.findOne({ email });
    if (!user) {
        await auth.api.signUpEmail({ body: { name, email, password } });
        user = await users.findOne({ email });
    }
    await users.updateOne({ _id: user._id }, { $set: { role, emailVerified: true, banned: false } });
    return { ...user, role };
}

async function main() {
    const db = await connectDB();
    const now = new Date();

    // ---- art / photos ----
    generateProductArt(products.map((p) => ({ slug: p.slug, art: p.art, category: p.category })));

    // ---- categories ----
    for (const c of categories) {
        const first = products.find((p) => p.category === c.slug);
        const image = first.photo ? `/products/${first.slug}.jpg` : `/products/${first.slug}-a.svg`;
        await db.collection("categories").updateOne(
            { slug: c.slug },
            { $set: { ...c, image }, $setOnInsert: { createdAt: now } },
            { upsert: true }
        );
    }

    // ---- products ----
    for (const [i, p] of products.entries()) {
        const image = p.photo ? `/products/${p.slug}.jpg` : `/products/${p.slug}-a.svg`;
        const images = p.photo ? [image] : ["a", "b", "c"].map((v) => `/products/${p.slug}-${v}.svg`);
        const discountPercent = p.compareAtPrice ? Math.round(((p.compareAtPrice - p.price) / p.compareAtPrice) * 100) : 0;
        const createdAt = new Date(now.getTime() - (products.length - i) * 36e5 * 20);

        await db.collection("products").updateOne(
            { slug: p.slug },
            {
                $set: {
                    title: p.title, slug: p.slug, description: p.description, price: p.price,
                    compareAtPrice: p.compareAtPrice, discountPercent, category: p.category, brand: p.brand,
                    image, images, sku: `SS-${String(i + 1).padStart(4, "0")}`,
                    specs: p.specs.map(([label, value]) => ({ label, value })),
                    colors: p.colors || [], sizes: p.sizes || [],
                    featured: Boolean(p.featured), isNew: Boolean(p.isNew), status: "active", updatedAt: now,
                },
                $setOnInsert: { stock: p.stock, sold: 0, rating: 0, reviewCount: 0, createdAt },
            },
            { upsert: true }
        );
    }

    // ---- pre-existing records from the old single-product version of the app ----
    // Not deleted (they hold real-looking customer details); just hidden from the storefront and admin order list.
    const hiddenProducts = await db.collection("products").updateMany({ slug: { $exists: false } }, { $set: { status: "draft", legacy: true } });
    const hiddenOrders = await db.collection("orders").updateMany({ orderNumber: { $exists: false } }, { $set: { legacy: true } });
    if (hiddenProducts.modifiedCount || hiddenOrders.modifiedCount) {
        console.log(`Hid ${hiddenProducts.modifiedCount} legacy products and ${hiddenOrders.modifiedCount} legacy orders (kept in the database).`);
    }

    // ---- coupons / faqs ----
    for (const c of coupons) {
        await db.collection("coupons").updateOne({ code: c.code }, { $set: c, $setOnInsert: { usedCount: 0, expiresAt: null, createdAt: now } }, { upsert: true });
    }
    for (const [i, [group, question, answer]] of faqs.entries()) {
        await db.collection("faqs").updateOne({ question }, { $set: { group, question, answer, order: i } }, { upsert: true });
    }

    // ---- demo users ----
    await ensureUser(db, { name: "ShopSphere Admin", email: "admin@shopsphere.demo", password: ADMIN_PASSWORD, role: "admin" });
    const demoUser = await ensureUser(db, { name: "Demo Customer", email: "user@shopsphere.demo", password: DEMO_PASSWORD, role: "user" });
    const buyers = [];
    for (const [name, email] of customers) buyers.push(await ensureUser(db, { name, email, password: DEMO_PASSWORD, role: "user" }));

    // ---- demo orders (so charts, verified reviews and the dashboard have real data) ----
    const dbProducts = await db.collection("products").find({ slug: { $exists: true } }).toArray();
    const bySlug = new Map(dbProducts.map((p) => [p.slug, p]));
    const people = [...buyers, demoUser];
    const statuses = ["delivered", "delivered", "delivered", "shipped", "processing", "delivered", "processing", "delivered"];
    const orderPlan = [];
    for (let n = 0; n < 36; n += 1) {
        const person = people[n % people.length];
        const picks = [products[(n * 5) % products.length], products[(n * 7 + 3) % products.length]];
        orderPlan.push({ n, person, picks: n % 3 === 0 ? picks : [picks[0]], daysAgo: Math.floor((n * 29) / 35), status: statuses[n % statuses.length] });
    }

    for (const plan of orderPlan) {
        const orderNumber = `SEED-${String(plan.n + 1).padStart(4, "0")}`;
        const items = plan.picks.map((pick, k) => {
            const product = bySlug.get(pick.slug);
            const quantity = ((plan.n + k) % 2) + 1;
            return { productId: product._id, title: product.title, image: product.image, variant: null, unitPrice: product.price, quantity, lineTotal: Math.round(product.price * quantity * 100) / 100 };
        });
        const subtotal = Math.round(items.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100;
        const shipping = subtotal >= 75 ? 0 : 5.99;
        const tax = Math.round(subtotal * 0.08 * 100) / 100;
        const paidAt = new Date(now.getTime() - plan.daysAgo * 864e5 - plan.n * 3e5);
        const addr = addresses[people.indexOf(plan.person)];
        const timeline = [
            { status: "pending_payment", note: "Order created, waiting for payment", at: new Date(paidAt.getTime() - 6e4) },
            { status: "processing", note: "Payment received", at: paidAt },
            ...(["shipped", "delivered"].includes(plan.status) ? [{ status: "shipped", note: "Order marked as shipped", at: new Date(paidAt.getTime() + 864e5) }] : []),
            ...(plan.status === "delivered" ? [{ status: "delivered", note: "Order marked as delivered", at: new Date(paidAt.getTime() + 4 * 864e5) }] : []),
        ];
        await db.collection("orders").updateOne(
            { orderNumber },
            {
                $setOnInsert: {
                    orderNumber, userId: String(plan.person._id),
                    customer: { name: plan.person.name, email: plan.person.email, phone: addr[1] },
                    items, subtotal, discount: 0, couponCode: null, shipping, tax,
                    total: Math.round((subtotal + shipping + tax) * 100) / 100, currency: "usd",
                    shippingAddress: { fullName: addr[0], phone: addr[1], line1: addr[2], line2: addr[3], city: addr[4], state: addr[5], postalCode: addr[6], country: addr[7] },
                    paymentMethod: "stripe", paymentStatus: "paid", status: plan.status,
                    seeded: true, paymentIntentId: `pi_seed_${orderNumber}`,
                    estimatedDelivery: { from: new Date(paidAt.getTime() + 3 * 864e5), to: new Date(paidAt.getTime() + 7 * 864e5) },
                    timeline, paidAt, createdAt: new Date(paidAt.getTime() - 6e4), updatedAt: paidAt,
                },
            },
            { upsert: true }
        );
    }

    // ---- addresses for the demo customer ----
    await db.collection("addresses").updateOne(
        { userId: String(demoUser._id), line1: "221 Market Street" },
        { $setOnInsert: { userId: String(demoUser._id), label: "Home", fullName: "Demo Customer", phone: "+1 415 555 0134", line1: "221 Market Street", line2: "Apt 4B", city: "San Francisco", state: "CA", postalCode: "94105", country: "US", isDefault: true, createdAt: now } },
        { upsert: true }
    );

    // ---- reviews: only from customers who really have a (seed) paid order for that product ----
    const paidOrders = await db.collection("orders").find({ seeded: true }).toArray();
    let r = 0;
    for (const order of paidOrders) {
        for (const item of order.items) {
            const person = people.find((p) => String(p._id) === order.userId);
            const [rating, title, comment] = reviewPool[r % reviewPool.length];
            r += 1;
            if (r % 3 === 0) continue; // not every purchase gets a review
            await db.collection("reviews").updateOne(
                { productId: item.productId, userId: order.userId },
                { $setOnInsert: { productId: item.productId, productTitle: item.title, userId: order.userId, userName: person.name, userImage: null, rating, title, comment, verifiedPurchase: true, status: "approved", createdAt: new Date(order.paidAt.getTime() + 6 * 864e5) } },
                { upsert: true }
            );
        }
    }

    // ---- derived counters ----
    for (const p of dbProducts) {
        const [agg] = await db.collection("reviews").aggregate([{ $match: { productId: p._id, status: "approved" } }, { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }]).toArray();
        const sold = await db.collection("orders").aggregate([{ $match: { seeded: true } }, { $unwind: "$items" }, { $match: { "items.productId": p._id } }, { $group: { _id: null, qty: { $sum: "$items.quantity" } } }]).toArray();
        const seedSold = products.find((x) => x.slug === p.slug).sold || 0;
        await db.collection("products").updateOne(
            { _id: p._id },
            { $set: { rating: agg ? Math.round(agg.avg * 10) / 10 : 0, reviewCount: agg?.count || 0, sold: Math.max(seedSold, sold[0]?.qty || 0) } }
        );
    }

    console.log(`Seed complete: ${categories.length} categories, ${products.length} products, ${coupons.length} coupons, ${faqs.length} FAQs, ${orderPlan.length} demo orders.`);
    console.log("Demo admin : admin@shopsphere.demo  (password from SEED_ADMIN_PASSWORD, default in README)");
    console.log("Demo user  : user@shopsphere.demo   (password from SEED_DEMO_PASSWORD, default in README)");
    await closeDB();
}

main().catch(async (err) => {
    console.error("Seed failed:", err);
    await closeDB().catch(() => {});
    process.exit(1);
});
