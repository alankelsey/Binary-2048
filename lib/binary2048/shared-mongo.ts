import { MongoClient } from "mongodb";

const state = globalThis as typeof globalThis & { __binary2048_shared_mongo?: Promise<MongoClient> };

/** One bounded pool per runtime; never expose connection strings. */
export async function sharedMongoClient(): Promise<MongoClient> {
  if (!state.__binary2048_shared_mongo) {
    const uri = process.env.BINARY2048_MONGO_URI;
    if (!uri) throw new Error("Shared storage is not configured");
    const client = new MongoClient(uri, {
      maxPoolSize: 5, minPoolSize: 0, serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000, socketTimeoutMS: 10000, retryWrites: true
    });
    state.__binary2048_shared_mongo = client.connect().catch(async () => {
      delete state.__binary2048_shared_mongo;
      await client.close().catch(() => undefined);
      throw new Error("Shared storage is temporarily unavailable");
    });
  }
  return state.__binary2048_shared_mongo;
}

export async function sharedMongoDb() {
  return (await sharedMongoClient()).db(process.env.BINARY2048_MONGO_DB ?? "binary2048");
}
