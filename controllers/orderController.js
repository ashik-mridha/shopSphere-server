import { ObjectId } from "mongodb";

export function createOrderController({
    productsCollection,
    ordersCollection,
}) {
    async function createOrder(req, res) {
        try {
            const { productId, quantity, customer } = req.body;

            if (
                typeof productId !== "string" ||
                !/^[a-fA-F0-9]{24}$/.test(productId)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid product ID",
                });
            }

            if (
                !Number.isInteger(quantity) ||
                quantity < 1 ||
                quantity > 99
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Quantity must be between 1 and 99",
                });
            }

            const name =
                typeof customer?.name === "string"
                    ? customer.name.trim()
                    : "";

            const phone =
                typeof customer?.phone === "string"
                    ? customer.phone.trim()
                    : "";

            const address =
                typeof customer?.address === "string"
                    ? customer.address.trim()
                    : "";

            if (
                name.length < 2 ||
                name.length > 100 ||
                phone.length < 7 ||
                phone.length > 20 ||
                address.length < 5 ||
                address.length > 500
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide valid customer details",
                });
            }

            const product = await productsCollection.findOne({
                _id: new ObjectId(productId),
            });

            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found",
                });
            }

            const unitPrice = Number(product.price);

            if (
                !Number.isFinite(unitPrice) ||
                unitPrice < 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Product price is invalid",
                });
            }

            const total = unitPrice * quantity;

            const order = {
                productId: product._id,
                productTitle: product.title,
                productImage: product.image,
                unitPrice,
                quantity,
                total,
                customer: {
                    name,
                    phone,
                    address,
                },
                paymentMethod: "Cash on Delivery",
                status: "Pending",
                createdAt: new Date(),
            };

            const result = await ordersCollection.insertOne(order);

            return res.status(201).json({
                success: true,
                message: "Order placed successfully",
                orderId: result.insertedId,
                order: {
                    ...order,
                    _id: result.insertedId,
                },
            });
        } catch (error) {
            console.error("Create order error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to place order",
            });
        }
    }

    async function getOrders(req, res) {
        try {
            const orders = await ordersCollection
                .find({})
                .sort({ createdAt: -1 })
                .toArray();

            return res.status(200).json(orders);
        } catch (error) {
            console.error("Fetch orders error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to fetch orders",
            });
        }
    }

    async function getOrderById(req, res) {
        try {
            const { id } = req.params;

            if (!ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid order ID format",
                });
            }

            const order = await ordersCollection.findOne({
                _id: new ObjectId(id),
            });

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found",
                });
            }

            return res.status(200).json({
                success: true,
                order,
            });
        } catch (error) {
            console.error("Fetch single order error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to load order tracking info",
            });
        }
    }

    // এডমিন প্যানেল থেকে অর্ডার স্ট্যাটাস আপডেট করার ফাংশন
    async function updateOrderStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;

            if (!ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid order ID format",
                });
            }

            const validStatuses = [
                "Pending",
                "Processing",
                "Shipped",
                "Delivered",
                "Cancelled",
            ];

            if (!status || !validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid status value",
                });
            }

            const result = await ordersCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { status, updatedAt: new Date() } }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found",
                });
            }

            return res.status(200).json({
                success: true,
                message: "Order status updated successfully",
            });
        } catch (error) {
            console.error("Update order status error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to update order status",
            });
        }
    }

    return {
        createOrder,
        getOrders,
        getOrderById,
        updateOrderStatus, // রাউটার ব্যবহারের জন্য এক্সপোর্ট করা হলো
    };
}