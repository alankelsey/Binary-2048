export default function DocsHomePage() {
  return (
    <main>
      <div className="card">
        <h1>Documentation</h1>
        <p className="brand-subtitle">Choose user or developer docs.</p>
        <div className="api-doc-grid">
          <section className="api-doc-card">
            <h2>User Guide</h2>
            <p>Gameplay, controls, replay usage, and accessibility.</p>
            <p>
              <a href="/docs/user">Open user docs</a>
            </p>
          </section>
          <section className="api-doc-card">
            <h2>Developer Guide</h2>
            <p>API integration, replay model, testing, and environment setup.</p>
            <p>
              <a href="/docs/developer">Open developer docs</a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
