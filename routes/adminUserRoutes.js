
import express from "express";
import { createAdminUserController } from "../controllers/adminUserController.js";

const adminUserRoutes = ({ db, auth }) => {
    const router = express.Router();

    const {
        requireAdmin,
        getUsers,
    } = createAdminUserController({ db, auth });

    router.get("/", requireAdmin, getUsers);

    return router;
};

export default adminUserRoutes;
