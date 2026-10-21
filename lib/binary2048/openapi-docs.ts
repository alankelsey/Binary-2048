import { OPENAPI_SPEC } from "@/lib/binary2048/openapi";

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

export type ApiDocOperation = {
  method: HttpMethod;
  summary: string;
  parameters: string[];
  requestBody: boolean;
  responses: Array<{ status: string; description: string }>;
  auth: string;
  scopes: string[];
  rateLimit: string;
  version: string;
  examples?: { request?: string; response?: string };
};

export type ApiDocEntry = {
  path: string;
  operations: ApiDocOperation[];
};

const METHOD_ORDER: HttpMethod[] = ["get", "post", "put", "patch", "delete"];

export function getApiDocEntries() {
  const pathEntries = Object.entries(OPENAPI_SPEC.paths).sort(([a], [b]) => a.localeCompare(b));
  const entries: ApiDocEntry[] = [];

  for (const [path, item] of pathEntries) {
    const itemByMethod = item as Partial<Record<HttpMethod, {
      summary?: string;
      parameters?: ReadonlyArray<{ name?: string; in?: string; required?: boolean }>;
      requestBody?: unknown;
      responses?: Record<string, { description?: string }>;
      "x-auth-description"?: string;
      "x-required-scopes"?: ReadonlyArray<string>;
      "x-rate-limit-policy"?: string;
      "x-api-version"?: string;
      "x-safe-examples"?: { request?: string; response?: string };
    }>>;
    const operations: ApiDocOperation[] = [];

    for (const method of METHOD_ORDER) {
      const operation = itemByMethod[method];
      if (!operation) continue;
      operations.push({
        method,
        summary: operation.summary ?? "No summary",
        parameters: (operation.parameters ?? []).map((parameter) => {
          const location = parameter.in ? ` (${parameter.in})` : "";
          const required = parameter.required ? ", required" : "";
          return `${parameter.name ?? "unnamed"}${location}${required}`;
        }),
        requestBody: Boolean(operation.requestBody),
        responses: Object.entries(operation.responses ?? {}).map(([status, response]) => ({
          status,
          description: response.description ?? "No description"
        })),
        auth: operation["x-auth-description"] ?? "Not yet audited",
        scopes: [...(operation["x-required-scopes"] ?? [])],
        rateLimit: operation["x-rate-limit-policy"] ?? "Not yet audited",
        version: operation["x-api-version"] ?? "Not yet audited",
        examples: operation["x-safe-examples"]
      });
    }

    entries.push({
      path,
      operations
    });
  }

  return entries;
}
