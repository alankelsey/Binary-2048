import { OPENAPI_SPEC } from "@/lib/binary2048/openapi";
import { getApiDocEntries } from "@/lib/binary2048/openapi-docs";
import { ApiExplorer } from "@/app/api-docs/api-explorer";

export default function ApiDocsPage() {
  const entries = getApiDocEntries();

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
        <p>
          Docs hub: <a href="/docs">/docs</a> | User guide: <a href="/docs/user">/docs/user</a> | Developer guide:{" "}
          <a href="/docs/developer">/docs/developer</a>
        </p>

        <ApiExplorer entries={entries} />
      </div>
    </main>
  );
}
