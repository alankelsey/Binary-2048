import type { Collection } from "mongodb";
import { sharedMongoDb } from "@/lib/binary2048/shared-mongo";
import { createScenarioDraft, type ScenarioDraft } from "@/lib/binary2048/scenario-draft";

type StoredScenarioDraft = ScenarioDraft & { ownerId: string };

async function scenarioDraftCollection(): Promise<Collection<StoredScenarioDraft>> {
  const collection = (await sharedMongoDb()).collection<StoredScenarioDraft>("scenario_drafts");
  await collection.createIndex({ ownerId: 1, id: 1 }, { unique: true });
  await collection.createIndex({ ownerId: 1, updatedAtISO: -1 });
  return collection;
}

export async function listScenarioDrafts(ownerId: string): Promise<ScenarioDraft[]> {
  const records = await (await scenarioDraftCollection())
    .find({ ownerId }, { projection: { ownerId: 0, _id: 0 } })
    .sort({ updatedAtISO: -1 })
    .limit(100)
    .toArray();
  return records.map(withoutOwner);
}

export async function saveScenarioDraft(ownerId: string, incoming: ScenarioDraft): Promise<ScenarioDraft> {
  const collection = await scenarioDraftCollection();
  const existing = await collection.findOne({ ownerId, id: incoming.id });
  const draft = createScenarioDraft({
    id: incoming.id,
    name: incoming.name,
    scenario: incoming.scenario,
    existing: existing ? withoutOwner(existing) : undefined
  });
  await collection.replaceOne({ ownerId, id: draft.id }, { ...draft, ownerId }, { upsert: true });
  return draft;
}

export async function deleteScenarioDraft(ownerId: string, id: string): Promise<boolean> {
  const result = await (await scenarioDraftCollection()).deleteOne({ ownerId, id });
  return result.deletedCount === 1;
}

function withoutOwner(record: StoredScenarioDraft): ScenarioDraft {
  return {
    draftVersion: record.draftVersion,
    id: record.id,
    name: record.name,
    createdAtISO: record.createdAtISO,
    updatedAtISO: record.updatedAtISO,
    scenario: record.scenario
  };
}
