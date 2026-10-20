
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
    } = createOrderController({
        productsCollection,
        ordersCollection,
    });

    router.post("/", createOrder);
    router.get("/", getOrders);

    return router;
};

export default orderRoutes;
