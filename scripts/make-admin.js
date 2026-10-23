// Usage: node scripts/make-admin.js <email> [--revoke]
//   promotes an EXISTING account to admin (sign up first, then run this on a machine that has DB access).
//   --revoke sets the role back to "user". Roles can never be set from the browser: Better Auth rejects `role`
//   in the sign-up body (FIELD_NOT_ALLOWED) and only admins can change roles through /api/admin/users/:id.
import { connectDB, closeDB } from "../config/database.js";

const [email, flag] = process.argv.slice(2);
if (!email || email.startsWith("--")) {
    console.error("Usage: node scripts/make-admin.js <email> [--revoke]");
    process.exit(1);
}

const db = await connectDB();
try {
    const role = flag === "--revoke" ? "user" : "admin";
    const result = await db.collection("user").updateOne({ email: email.trim().toLowerCase() }, { $set: { role, updatedAt: new Date() } });
    if (!result.matchedCount) {
        console.error(`No account found for ${email}. Register it first at /register.`);
        process.exitCode = 1;
    } else {
        console.log(`${email} is now "${role}". They must sign out and back in for the new role to show.`);
    }
} finally {
    await closeDB();
}
