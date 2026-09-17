import { createClientAuthBridge } from "@/lib/binary2048/client-auth-bridge";

describe("client auth bridge", () => {
  it("deduplicates token minting and reuses a valid token", async () => {
    const request = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ token: "signed-token", exp: 4600 })
    }));
    const bridge = createClientAuthBridge(request, () => 1_000_000);

    const [first, second] = await Promise.all([
      bridge.authorizationHeader(),
      bridge.authorizationHeader()
    ]);
    const third = await bridge.authorizationHeader();

    expect(first).toEqual({ authorization: "Bearer signed-token" });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("caches a guest result briefly without surfacing an error", async () => {
    const request = jest.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "Authenticated session required" })
    }));
    const bridge = createClientAuthBridge(request, () => 1_000_000);

    expect(await bridge.authorizationHeader()).toEqual({});
    expect(await bridge.authorizationHeader()).toEqual({});
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("does not probe the protected token endpoint for a known guest", async () => {
    const request = jest.fn();
    let authenticated = false;
    const bridge = createClientAuthBridge(request, () => 1_000_000, () => authenticated);

    expect(await bridge.authorizationHeader()).toEqual({});
    expect(request).not.toHaveBeenCalled();

    authenticated = true;
    request.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: "signed-token", exp: 4600 })
    });
    expect(await bridge.authorizationHeader()).toEqual({ authorization: "Bearer signed-token" });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
