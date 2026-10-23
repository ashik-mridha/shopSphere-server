import { z } from "zod";
import { HttpError, col, escapeRegex, pageMeta, parsePagination, toObjectId } from "../lib/http.js";

export const userUpdateSchema = z
    .object({
        role: z.enum(["user", "admin"]).optional(),
        banned: z.boolean().optional(),
        banReason: z.string().trim().max(200).optional(),
    })
    .refine((v) => v.role !== undefined || v.banned !== undefined, { message: "Nothing to update" });

const SORTS = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    name: { name: 1 },
};

export async function getUsers(req, res) {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 50 });
    const filter = {};

    if (["admin", "user"].includes(req.query.role)) {
        filter.role = req.query.role === "user" ? { $ne: "admin" } : "admin";
    }
    if (req.query.status === "blocked") filter.banned = true;
    if (req.query.status === "active") filter.banned = { $ne: true };

    if (typeof req.query.q === "string" && req.query.q.trim()) {
        const rx = new RegExp(escapeRegex(req.query.q.trim().slice(0, 100)), "i");
        filter.$or = [{ name: rx }, { email: rx }];
    }

    const users = col(req, "user");
    const [items, total] = await Promise.all([
        users
            .find(filter)
            .project({ name: 1, email: 1, role: 1, image: 1, banned: 1, banReason: 1, emailVerified: 1, createdAt: 1 })
            .sort(SORTS[req.query.sort] || SORTS.newest)
            .skip(skip)
            .limit(limit)
            .toArray(),
        users.countDocuments(filter),
    ]);

    const ids = items.map((u) => String(u._id));
    const orderStats = await col(req, "orders")
        .aggregate([
            { $match: { userId: { $in: ids }, paymentStatus: "paid" } },
            { $group: { _id: "$userId", orders: { $sum: 1 }, spent: { $sum: "$total" } } },
        ])
        .toArray();
    const statsById = new Map(orderStats.map((s) => [s._id, s]));

    res.json({
        success: true,
        data: items.map((u) => ({
            ...u,
            _id: String(u._id),
            role: u.role || "user",
            banned: Boolean(u.banned),
            orders: statsById.get(String(u._id))?.orders || 0,
            spent: Math.round((statsById.get(String(u._id))?.spent || 0) * 100) / 100,
        })),
        pagination: pageMeta(total, page, limit),
    });
}

export async function updateUser(req, res) {
    const id = toObjectId(req.params.id, "user ID");
    if (String(id) === req.user.id) {
        throw new HttpError(400, "You cannot change your own role or block yourself.");
    }

    const { role, banned, banReason } = req.valid.body;
    const set = { updatedAt: new Date() };
    if (role) set.role = role;
    if (banned !== undefined) {
        set.banned = banned;
        set.banReason = banned ? banReason || "Blocked by an administrator" : null;
    }

    const updated = await col(req, "user").findOneAndUpdate({ _id: id }, { $set: set }, { returnDocument: "after" });
    if (!updated) throw new HttpError(404, "User not found");

    // a blocked user is signed out everywhere immediately
    if (banned) {
        await col(req, "session").deleteMany({ userId: { $in: [id, String(id)] } });
    }

    res.json({
        success: true,
        message: "User updated",
        data: { _id: String(updated._id), name: updated.name, email: updated.email, role: updated.role || "user", banned: Boolean(updated.banned) },
    });
}

