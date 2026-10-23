import { mongoClient } from "./auth.js";
import { env } from "./env.js";
import { ensureIndexes } from "../lib/indexes.js";

export async function connectDB() {
    await mongoClient.connect();

    const db = mongoClient.db(env.dbName);
    await db.command({ ping: 1 });
    await ensureIndexes(db);

    return db;
}

export async function closeDB() {
    await mongoClient.close();
}
