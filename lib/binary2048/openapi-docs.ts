import { OPENAPI_SPEC } from "@/lib/binary2048/openapi";

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

export type ApiDocOperation = {
  method: HttpMethod;
  summary: string;
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
    const itemByMethod = item as Partial<Record<HttpMethod, { summary?: string }>>;
    const operations: ApiDocOperation[] = [];

    for (const method of METHOD_ORDER) {
      const operation = itemByMethod[method];
      if (!operation) continue;
      operations.push({
        method,
        summary: operation.summary ?? "No summary"
      });
    }

    entries.push({
      path,
      operations
    });
  }

  return entries;
}
