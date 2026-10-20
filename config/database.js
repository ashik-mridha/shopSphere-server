
import { MongoClient, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "shopsphere";

if (!uri) {
    throw new Error("MONGODB_URI is missing from your .env file");
}

export const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
    serverSelectionTimeoutMS: 10000,
});

export async function connectDB() {
    await client.connect();

    const db = client.db(DB_NAME);
    await db.command({ ping: 1 });

    console.log("MongoDB connected successfully!");

    return db;
}

export async function closeDB() {
    await client.close();
}
