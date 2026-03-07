export class RequestBodyTooLargeError extends Error {
  constructor(message = "Request body too large") {
    super(message);
    this.name = "RequestBodyTooLargeError";
  }
}

export async function parseJsonWithLimit<T>(req: Request, maxBytes: number): Promise<T> {
  const contentLength = req.headers.get("content-length");
  if (contentLength) {
    const parsed = Number(contentLength);
    if (Number.isFinite(parsed) && parsed > maxBytes) {
      throw new RequestBodyTooLargeError();
    }
  }

  const raw = await req.text();
  const byteLength = new TextEncoder().encode(raw).length;
  if (byteLength > maxBytes) {
    throw new RequestBodyTooLargeError();
  }

  return JSON.parse(raw) as T;
}
