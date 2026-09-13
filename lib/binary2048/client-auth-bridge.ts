type BridgeTokenResponse = {
  token?: unknown;
  exp?: unknown;
};

type BridgeFetch = (
  input: string,
  init: { method: "POST"; headers: Record<string, string>; body: string }
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export function createClientAuthBridge(
  request: BridgeFetch,
  now: () => number = Date.now
) {
  let token = "";
  let expiresAtMs = 0;
  let guestUntilMs = 0;
  let pending: Promise<string> | null = null;

  async function mint(): Promise<string> {
    const response = await request("/api/auth/bridge-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ttlSeconds: 3600 })
    });
    if (!response.ok) {
      if (response.status === 401) guestUntilMs = now() + 60_000;
      return "";
    }
    const payload = (await response.json().catch(() => ({}))) as BridgeTokenResponse;
    if (typeof payload.token !== "string" || typeof payload.exp !== "number") return "";
    token = payload.token;
    expiresAtMs = payload.exp * 1000;
    guestUntilMs = 0;
    return token;
  }

  async function getToken(): Promise<string> {
    if (token && expiresAtMs > now() + 30_000) return token;
    if (guestUntilMs > now()) return "";
    if (!pending) {
      pending = mint()
        .catch(() => "")
        .finally(() => {
          pending = null;
        });
    }
    return pending;
  }

  return {
    async authorizationHeader(): Promise<Record<string, string>> {
      const currentToken = await getToken();
      return currentToken ? { authorization: `Bearer ${currentToken}` } : {};
    }
  };
}
