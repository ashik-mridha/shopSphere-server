
import { ObjectId } from "mongodb";

// GET /api/products
export const getProducts = async (req, res, productsCollection) => {
    try {
        const products = await productsCollection
            .find({})
            .sort({ createdAt: -1 })
            .toArray();

        return res.status(200).json(products);
    } catch (error) {
        console.error("Get products error:", error);
        return res.status(500).json({
            message: "Error fetching products",
        });
    }
};

// POST /api/products
export const addProduct = async (req, res, productsCollection) => {
    try {
        const {
            title,
            price,
            category = "",
            image = "",
            description = "",
        } = req.body;

        if (
            typeof title !== "string" ||
            !title.trim() ||
            title.trim().length > 200 ||
            price === "" ||
            price === undefined ||
            !Number.isFinite(Number(price)) ||
            Number(price) < 0
        ) {
            return res.status(400).json({
                message: "Valid title and price are required",
            });
        }

        const product = {
            title: title.trim(),
            price: Number(price),
            category: String(category).trim(),
            image: String(image).trim(),
            description: String(description).trim(),
            createdAt: new Date(),
        };

        const result = await productsCollection.insertOne(product);

        return res.status(201).json({
            message: "Product added successfully",
            product: {
                _id: result.insertedId,
                ...product,
            },
        });
    } catch (error) {
        console.error("Add product error:", error);
        return res.status(500).json({
            message: "Error adding product",
        });
    }
};

// GET /api/products/:id
export const getProductById = async (
    req,
    res,
    productsCollection
) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid product ID",
            });
        }

        const product = await productsCollection.findOne({
            _id: new ObjectId(id),
        });

        if (!product) {
            return res.status(404).json({
                message: "Product not found",
            });
        }

        return res.status(200).json(product);
    } catch (error) {
        console.error("Get product details error:", error);
        return res.status(500).json({
            message: "Error fetching product details",
        });
    }
};

// PATCH /api/products/:id
export const updateProductPrice = async (
    req,
    res,
    productsCollection
) => {
    try {
        const { id } = req.params;
        const { price } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid product ID",
            });
        }

        if (
            price === "" ||
            price === undefined ||
            !Number.isFinite(Number(price)) ||
            Number(price) < 0
        ) {
            return res.status(400).json({
                message: "Invalid price",
            });
        }

        const result = await productsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { price: Number(price) } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                message: "Product not found",
            });
        }

        return res.status(200).json({
            message: "Price updated successfully",
        });
    } catch (error) {
        console.error("Update product error:", error);
        return res.status(500).json({
            message: "Error updating price",
        });
    }
};

// DELETE /api/products/:id
export const deleteProduct = async (
    req,
    res,
    productsCollection
) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid product ID",
            });
        }

        const result = await productsCollection.deleteOne({
            _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                message: "Product not found",
            });
        }

        return res.status(200).json({
            message: "Product deleted successfully",
        });
    } catch (error) {
        console.error("Delete product error:", error);
        return res.status(500).json({
            message: "Error deleting product",
        });
    }
};
