import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

export class ServerSessionLookupError extends Error {
  readonly code = "server_session_lookup_failed";

  constructor(readonly surface: string) {
    super("Server session lookup failed");
    this.name = "ServerSessionLookupError";
  }
}

function logLookupFailure(surface: string, error: unknown) {
  console.warn("Server session lookup failed", {
    event: "server_session_lookup_failed",
    surface,
    errorName: error instanceof Error ? error.name : "UnknownError"
  });
}

export async function getOptionalServerSession(surface: string) {
  try {
    return await getServerSession(authOptions);
  } catch (error) {
    logLookupFailure(surface, error);
    return null;
  }
}

export async function getRequiredServerSession(surface: string) {
  try {
    return await getServerSession(authOptions);
  } catch (error) {
    logLookupFailure(surface, error);
    throw new ServerSessionLookupError(surface);
  }
}
