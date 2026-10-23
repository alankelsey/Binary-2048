import { createHash } from "crypto";
import { authorizeResearchRequest } from "@/lib/binary2048/research-auth";

describe("research authorization", () => {
  afterAll(() => {
    delete process.env.BINARY2048_ADMIN_TOKEN;
    delete process.env.BINARY2048_ADMIN_SUBJECTS;
    delete process.env.BINARY2048_RESEARCH_SUBJECTS;
    delete process.env.BINARY2048_BOT_API_KEY_HASHES;
    delete process.env.BINARY2048_BOT_API_KEY_SCOPES;
  });
  beforeEach(() => {
    delete process.env.BINARY2048_ADMIN_TOKEN;
    delete process.env.BINARY2048_ADMIN_SUBJECTS;
    delete process.env.BINARY2048_RESEARCH_SUBJECTS;
    delete process.env.BINARY2048_BOT_API_KEY_HASHES;
    delete process.env.BINARY2048_BOT_API_KEY_SCOPES;
  });

  it("keeps API-key quota identity separate from authorization scopes", () => {
    const key = "research-key";
    process.env.BINARY2048_BOT_API_KEY_HASHES = `research=${createHash("sha256").update(key).digest("hex")}`;
    process.env.BINARY2048_BOT_API_KEY_SCOPES = "research=simulation:run|jobs:read";
    const req = new Request("http://localhost", { headers: { "x-api-key": key } });
    expect(authorizeResearchRequest(req, "simulation:run")).toMatchObject({ allowed: true });
    expect(authorizeResearchRequest(req, "replay:ingest")).toEqual({
      allowed: false,
      status: 403,
      error: "Research credential lacks replay:ingest scope"
    });
  });

  it("rejects missing credentials and permits the admin service credential", () => {
    expect(authorizeResearchRequest(new Request("http://localhost"), "training:read")).toMatchObject({ status: 401 });
    process.env.BINARY2048_ADMIN_TOKEN = "admin-secret";
    expect(authorizeResearchRequest(new Request("http://localhost", { headers: { "x-admin-token": "admin-secret" } }), "training:read"))
      .toMatchObject({ allowed: true, authority: { principal: "admin:service", admin: true } });
  });
});
