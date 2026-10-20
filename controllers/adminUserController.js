
export function createAdminUserController({ db, auth }) {
    async function requireAdmin(req, res, next) {
        try {
            const session = await auth.api.getSession({
                headers: req.headers,
            });

            if (!session?.user) {
                return res.status(401).json({
                    message: "Please log in first.",
                });
            }

            if (session.user.role !== "admin") {
                return res.status(403).json({
                    message: "Admin access required.",
                });
            }

            req.currentUser = session.user;
            return next();
        } catch (error) {
            console.error("Admin authentication error:", error);

            return res.status(401).json({
                message: "Unable to verify your session.",
            });
        }
    }

    async function getUsers(req, res) {
        try {
            const search =
                typeof req.query.search === "string"
                    ? req.query.search.trim().slice(0, 100)
                    : "";

            const role = String(
                req.query.role || "all"
            ).toLowerCase();

            if (!["all", "admin", "user"].includes(role)) {
                return res.status(400).json({
                    message: "Invalid role filter.",
                });
            }

            const usersCollection = db.collection("user");
            const filter = {};

            if (role !== "all") {
                filter.role = role;
            }

            if (search) {
                const escapedSearch = search.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                );

                filter.$or = [
                    {
                        name: {
                            $regex: escapedSearch,
                            $options: "i",
                        },
                    },
                    {
                        email: {
                            $regex: escapedSearch,
                            $options: "i",
                        },
                    },
                ];
            }

            const users = await usersCollection
                .find(filter)
                .project({
                    name: 1,
                    email: 1,
                    role: 1,
                    image: 1,
                    emailVerified: 1,
                    createdAt: 1,
                })
                .sort({ createdAt: -1 })
                .limit(500)
                .toArray();

            return res.status(200).json({
                success: true,
                users: users.map((user) => ({
                    ...user,
                    _id: user._id.toString(),
                })),
            });
        } catch (error) {
            console.error("Fetch users error:", error);

            return res.status(500).json({
                message: "Failed to load users.",
            });
        }
    }

    return {
        requireAdmin,
        getUsers,
    };
}
