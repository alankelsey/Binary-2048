import { MemorySessionStore, MongoSessionStore, SessionConflictError } from "./session-store";
import { createSession } from "./sessions";

it("rejects competing stale writers and leaves the winning state intact", async () => {
  const store = new MemorySessionStore();
  const session = await createSession({ seed: 203 });
  await store.set(session.current.id, session);
  const first = (await store.get(session.current.id))!;
  const stale = (await store.get(session.current.id))!;
  first.undoUsed = 1;
  await store.set(session.current.id, first);
  stale.undoUsed = 2;
  await expect(store.set(session.current.id, stale)).rejects.toBeInstanceOf(SessionConflictError);
  expect((await store.get(session.current.id))?.undoUsed).toBe(1);
});

it("awaits Mongo hydration on the first cold read and deletes durable state", async () => {
  const original = await createSession({ seed: 204 });
  const collection = {
    createIndexes: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockImplementation(async () => { await new Promise(resolve => setTimeout(resolve, 5)); return { session: original, revision: 7, expiresAt: new Date(Date.now() + 60000) }; }),
    replaceOne: jest.fn().mockResolvedValue({ matchedCount: 1 }),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 })
  };
  const store = new MongoSessionStore(async () => collection as never);
  const hydrated = await store.get(original.current.id);
  expect(hydrated?.current.id).toBe(original.current.id);
  await store.set(original.current.id, hydrated!);
  expect(collection.replaceOne.mock.calls[0][0]).toEqual({ id: original.current.id, revision: 7 });
  await store.delete(original.current.id);
  expect(collection.deleteOne).toHaveBeenCalledWith({ id: original.current.id });
});
