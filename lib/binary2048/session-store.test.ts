import { getSessionStore, resetSessionStoreForTests } from "@/lib/binary2048/session-store";
import { createSession } from "@/lib/binary2048/sessions";

describe("session-store", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetSessionStoreForTests();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("uses memory session store by default", async () => {
    const store = getSessionStore();
    const session = (await createSession({ seed: 777 }));
    await store.set(session.current.id, session);
    expect((await store.get(session.current.id))?.current.id).toBe(session.current.id);
  });

  it("throws when mongo mode is selected without mongo uri", () => {
    process.env.BINARY2048_SESSION_STORE = "mongo";
    delete process.env.BINARY2048_MONGO_URI;
    expect(() => getSessionStore()).toThrow("BINARY2048_MONGO_URI is required when BINARY2048_SESSION_STORE=mongo");
  });
});
