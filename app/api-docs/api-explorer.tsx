"use client";

import { useMemo, useState } from "react";
import type { ApiDocEntry } from "@/lib/binary2048/openapi-docs";

export function ApiExplorer({ entries }: { entries: ApiDocEntry[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => entries.flatMap((entry) => {
    const operations = entry.operations.filter((operation) => {
      const haystack = `${entry.path} ${operation.method} ${operation.summary}`.toLowerCase();
      return !normalizedQuery || haystack.includes(normalizedQuery);
    });
    return operations.length ? [{ ...entry, operations }] : [];
  }), [entries, normalizedQuery]);

  return (
    <section aria-labelledby="api-explorer-heading">
      <h2 id="api-explorer-heading">Interactive explorer</h2>
      <label className="api-search-label" htmlFor="api-search">Filter paths and operations</label>
      <input
        id="api-search"
        className="api-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="For example: replay, POST, /api/games"
      />
      <p className="brand-subtitle" role="status">{filtered.reduce((count, entry) => count + entry.operations.length, 0)} operations shown</p>

      <div className="api-doc-grid">
        {filtered.map((entry) => (
          <section key={entry.path} className="api-doc-card">
            <code className="api-path">{entry.path}</code>
            {entry.operations.map((operation) => (
              <details key={`${entry.path}-${operation.method}`} className="api-op-details">
                <summary className="api-op">
                  <span className={`api-method api-method-${operation.method}`}>{operation.method.toUpperCase()}</span>
                  <span>{operation.summary}</span>
                </summary>
                <div className="api-op-contract">
                  <p><strong>Request body:</strong> {operation.requestBody ? "documented" : "none"}</p>
                  <p><strong>Parameters:</strong> {operation.parameters.length ? operation.parameters.join(", ") : "none"}</p>
                  <strong>Responses</strong>
                  <ul>
                    {operation.responses.map((response) => <li key={response.status}><code>{response.status}</code> {response.description}</li>)}
                  </ul>
                </div>
              </details>
            ))}
          </section>
        ))}
      </div>
      {filtered.length === 0 ? <p>No API operations match this filter.</p> : null}
    </section>
  );
}
