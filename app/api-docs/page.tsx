import { OPENAPI_SPEC } from "@/lib/binary2048/openapi";

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

const METHOD_ORDER: HttpMethod[] = ["get", "post", "put", "patch", "delete"];

export default function ApiDocsPage() {
  const pathEntries = Object.entries(OPENAPI_SPEC.paths).sort(([a], [b]) => a.localeCompare(b));

  return (
    <main>
      <div className="card">
        <h1>API Docs</h1>
        <p className="brand-subtitle">
          {OPENAPI_SPEC.info.title} v{OPENAPI_SPEC.info.version}
        </p>
        <p>
          OpenAPI JSON source: <a href="/api/openapi">/api/openapi</a>
        </p>

        <div className="api-doc-grid">
          {pathEntries.map(([path, item]) => {
            const itemByMethod = item as Partial<Record<HttpMethod, { summary?: string }>>;
            const methods = METHOD_ORDER.filter((method) => itemByMethod[method]);
            return (
              <section key={path} className="api-doc-card">
                <code className="api-path">{path}</code>
                {methods.map((method) => {
                  const operation = itemByMethod[method];
                  if (!operation) return null;
                  return (
                    <div key={`${path}-${method}`} className="api-op">
                      <span className={`api-method api-method-${method}`}>{method.toUpperCase()}</span>
                      <span>{operation.summary ?? "No summary"}</span>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
