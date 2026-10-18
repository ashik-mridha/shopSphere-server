
import express from "express";
import {
    getProducts,
    addProduct,
    updateProductPrice,
    deleteProduct,
    getProductById,
} from "../controllers/productController.js";

const productRoutes = (productsCollection) => {
    const router = express.Router();

    router.get("/", (req, res) =>
        getProducts(req, res, productsCollection)
    );

    router.post("/", (req, res) =>
        addProduct(req, res, productsCollection)
    );

    router.patch("/:id", (req, res) =>
        updateProductPrice(req, res, productsCollection)
    );

    router.delete("/:id", (req, res) =>
        deleteProduct(req, res, productsCollection)
    );
    router.get("/:id", (req, res) =>
        getProductById(req, res, productsCollection)
    );

    return router;
};

export default productRoutes;
