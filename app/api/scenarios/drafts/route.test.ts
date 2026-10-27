jest.mock("@/lib/binary2048/server-session", () => ({
  getRequiredServerSession: jest.fn(),
  ServerSessionLookupError: class ServerSessionLookupError extends Error {}
}));
jest.mock("@/lib/binary2048/scenario-draft-store", () => ({
  listScenarioDrafts: jest.fn(),
  saveScenarioDraft: jest.fn(),
  deleteScenarioDraft: jest.fn()
}));

import { DELETE, GET, POST } from "@/app/api/scenarios/drafts/route";
import { createScenarioDraft } from "@/lib/binary2048/scenario-draft";
import { createScenarioBuilderState } from "@/lib/binary2048/scenario-builder";
import { getRequiredServerSession } from "@/lib/binary2048/server-session";
import { deleteScenarioDraft, listScenarioDrafts, saveScenarioDraft } from "@/lib/binary2048/scenario-draft-store";

const mockSession = getRequiredServerSession as jest.Mock;
const mockList = listScenarioDrafts as jest.Mock;
const mockSave = saveScenarioDraft as jest.Mock;
const mockDelete = deleteScenarioDraft as jest.Mock;

describe("scenario draft API", () => {
  beforeEach(() => jest.clearAllMocks());

  it("requires an authenticated identity", async () => {
    mockSession.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("lists drafts through a hashed owner ID", async () => {
    mockSession.mockResolvedValue({ user: { email: "player@example.com" } });
    mockList.mockResolvedValue([]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(mockList.mock.calls[0][0]).not.toContain("player@example.com");
  });

  it("validates and saves a versioned private draft", async () => {
    mockSession.mockResolvedValue({ user: { name: "Player" } });
    const draft = createScenarioDraft({ id: "draft_12345678", name: "Opening", scenario: createScenarioBuilderState() });
    mockSave.mockResolvedValue(draft);
    const response = await POST(new Request("http://localhost/api/scenarios/drafts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft)
    }));
    expect(response.status).toBe(200);
    expect(mockSave).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/), expect.objectContaining({ id: draft.id }));

    const invalid = await POST(new Request("http://localhost/api/scenarios/drafts", {
      method: "POST",
      body: JSON.stringify({ ...draft, draftVersion: 99 })
    }));
    expect(invalid.status).toBe(400);
  });

  it("deletes only through the authenticated owner scope", async () => {
    mockSession.mockResolvedValue({ user: { email: "player@example.com" } });
    mockDelete.mockResolvedValue(true);
    const response = await DELETE(new Request("http://localhost/api/scenarios/drafts?id=draft_12345678", { method: "DELETE" }));
    expect(response.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/), "draft_12345678");
  });
});
