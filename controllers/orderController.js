
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

    return {
        createOrder,
        getOrders,
    };
}
