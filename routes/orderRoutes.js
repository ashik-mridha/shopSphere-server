import express from "express";
import { createOrderController } from "../controllers/orderController.js";

const orderRoutes = ({
    productsCollection,
    ordersCollection,
}) => {
    const router = express.Router();

    const {
        createOrder,
        getOrders,
        getOrderById,
        updateOrderStatus, 
    } = createOrderController({
        productsCollection,
        ordersCollection,
    });

    router.post("/", createOrder);
    router.get("/", getOrders);

    router.get("/:id", getOrderById);

    router.patch("/:id", updateOrderStatus);

    return router;
};

export default orderRoutes;