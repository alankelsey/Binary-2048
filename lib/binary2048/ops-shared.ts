import { sharedMongoDb } from "@/lib/binary2048/shared-mongo";

export const sharedOpsEnabled = () => process.env.BINARY2048_OPS_STORE === "mongo";
export const opsSource = () => ({ scope: sharedOpsEnabled() ? "shared" : "runtime", readOnly: true });
export async function readOpsValue<T>(id: string): Promise<T | null> {
  const collection = (await sharedMongoDb()).collection<{ _id: string; value: T }>("ops_state");
  return (await collection.findOne({ _id: id }))?.value ?? null;
}
export async function writeOpsValue<T>(id: string, value: T) {
  const collection = (await sharedMongoDb()).collection<{ _id: string; value: T }>("ops_state");
  await collection.replaceOne({ _id: id }, { value }, { upsert: true });
  return value;
}
