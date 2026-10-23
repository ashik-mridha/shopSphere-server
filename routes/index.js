import express from "express";

import { requireAuth, requireAdmin, optionalAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { paymentLimiter, publicWriteLimiter } from "../middleware/rateLimit.js";
import { quoteSchema } from "../lib/pricing.js";
import { patchSchema } from "../lib/zodUtils.js";

import * as products from "../controllers/productController.js";
import * as categories from "../controllers/categoryController.js";
import * as cart from "../controllers/cartController.js";
import * as wishlist from "../controllers/wishlistController.js";
import * as reviews from "../controllers/reviewController.js";
import * as coupons from "../controllers/couponController.js";
import * as addresses from "../controllers/addressController.js";
import * as engagement from "../controllers/engagementController.js";
import * as orders from "../controllers/orderController.js";
import * as payments from "../controllers/paymentController.js";
import * as stats from "../controllers/statsController.js";
import * as adminUsers from "../controllers/adminUserController.js";

const router = express.Router();

// ---------- public catalogue ----------
router.get("/products", validate(products.listQuerySchema, "query"), products.getProducts);
router.get("/products/meta/filters", products.getFilterMeta);
router.get("/products/:idOrSlug", optionalAuth, products.getProduct);
router.get("/products/:idOrSlug/related", products.getRelated);
router.get("/products/:idOrSlug/reviews", reviews.getProductReviews);
router.get("/products/:idOrSlug/reviews/eligibility", optionalAuth, reviews.getReviewEligibility);
router.post("/products/:idOrSlug/reviews", requireAuth, validate(reviews.reviewSchema), reviews.createReview);

router.get("/categories", categories.getCategories);
router.get("/reviews/featured", reviews.getFeaturedReviews);
router.get("/coupons/public", cart.getPublicCoupons);
router.get("/faqs", engagement.getFaqs);
router.get("/stats/public", stats.getPublicStats);

router.post("/cart/quote", validate(quoteSchema), cart.quoteCart);
router.post("/contact", publicWriteLimiter, validate(engagement.contactSchema), engagement.createMessage);
router.post("/newsletter", publicWriteLimiter, validate(engagement.newsletterSchema), engagement.subscribeNewsletter);

// ---------- signed-in customer ----------
router.get("/wishlist", requireAuth, wishlist.getWishlist);
router.post("/wishlist/:productId", requireAuth, wishlist.addToWishlist);
router.delete("/wishlist/:productId", requireAuth, wishlist.removeFromWishlist);

router.get("/addresses", requireAuth, addresses.getAddresses);
router.post("/addresses", requireAuth, validate(addresses.addressSchema), addresses.createAddress);
router.patch("/addresses/:id", requireAuth, validate(patchSchema(addresses.addressSchema)), addresses.updateAddress);
router.delete("/addresses/:id", requireAuth, addresses.deleteAddress);

router.get("/orders", requireAuth, orders.getMyOrders);
router.get("/orders/:id", requireAuth, orders.getOrder);
router.post("/orders/:id/cancel", requireAuth, orders.cancelMyOrder);

// ---------- payments (webhook is mounted in app.js, before express.json) ----------
router.post(
    "/payments/create-checkout-session",
    paymentLimiter,
    requireAuth,
    validate(payments.checkoutSchema),
    payments.createCheckoutSession
);
router.get("/payments/session/:id", paymentLimiter, requireAuth, payments.getSessionStatus);
router.post("/payments/:orderId/refund", paymentLimiter, requireAdmin, validate(payments.refundSchema), payments.refundOrder);

// ---------- admin ----------
const admin = express.Router();
admin.use(requireAdmin);

admin.get("/stats", stats.getAdminStats);

admin.get("/products", validate(products.listQuerySchema, "query"), products.getAdminProducts);
admin.post("/products", validate(products.productSchema), products.createProduct);
admin.patch("/products/:id", validate(products.productUpdateSchema), products.updateProduct);
admin.delete("/products/:id", products.deleteProduct);

admin.post("/categories", validate(categories.categorySchema), categories.createCategory);
admin.patch("/categories/:id", validate(patchSchema(categories.categorySchema)), categories.updateCategory);
admin.delete("/categories/:id", categories.deleteCategory);

admin.get("/orders", orders.getAdminOrders);
admin.patch("/orders/:id/status", validate(orders.orderStatusSchema), orders.updateOrderStatus);

admin.get("/users", adminUsers.getUsers);
admin.patch("/users/:id", validate(adminUsers.userUpdateSchema), adminUsers.updateUser);

admin.get("/coupons", coupons.getCoupons);
admin.post("/coupons", validate(coupons.couponSchema), coupons.createCoupon);
admin.patch("/coupons/:id", validate(coupons.couponUpdateSchema), coupons.updateCoupon);
admin.delete("/coupons/:id", coupons.deleteCoupon);

admin.get("/messages", engagement.getMessages);
admin.patch("/messages/:id", validate(engagement.messageStatusSchema), engagement.updateMessage);
admin.delete("/messages/:id", engagement.deleteMessage);

admin.get("/reviews", reviews.getAdminReviews);
admin.patch("/reviews/:id", validate(reviews.reviewModerationSchema), reviews.moderateReview);
admin.delete("/reviews/:id", reviews.deleteReview);

router.use("/admin", admin);

export default router;
