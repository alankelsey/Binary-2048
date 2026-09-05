export function evaluateChallengeTrace(scenario, trace) {
  const expectedActions = scenario.expectedInvariants.probes.map((probe) => probe.action);
  const firstDecision = trace?.decisions?.[0]?.decision;
  const selectedAction = firstDecision?.action ?? null;
  const fallback = Boolean(firstDecision?.fallback);
  return {
    passed: !fallback && selectedAction !== null && expectedActions.includes(selectedAction),
    selectedAction,
    expectedActions,
    fallback,
    criterion: "non-fallback first action matches a validated scenario probe"
  };
}

export function correctFallbackObjectives(records) {
  let corrected = 0;
  for (const record of records) {
    if (record.trace?.decisions?.[0]?.decision?.fallback === true && record.objective?.passed === true) {
      record.objective.passed = false;
      record.objective.fallback = true;
      record.objective.criterion = "non-fallback first action matches a validated scenario probe";
      corrected += 1;
    }
  }
  return corrected;
}

export function summarizeChallengeRecords(records) {
  const groups = new Map();
  for (const record of records) {
    const maxOutputTokens = record.model.parameters?.maxOutputTokens ?? null;
    const key = `${record.model.provider}:${record.model.id}:${record.model.type}:${Boolean(record.model.thinkingEnabled)}:${maxOutputTokens}`;
    const current = groups.get(key) ?? {
      modelId: record.model.id,
      provider: record.model.provider,
      modelType: record.model.type,
      thinkingEnabled: Boolean(record.model.thinkingEnabled),
      maxOutputTokens,
      scenarios: 0,
      passed: 0,
      moves: 0,
      score: 0,
      inputTokens: 0,
      outputTokens: 0,
      fallbacks: 0,
      totalLatencyMs: 0,
      listedCostUsd: 0,
      conservativeCostUsd: 0
    };
    current.scenarios += 1;
    current.passed += record.objective?.passed ? 1 : 0;
    current.moves += record.metrics?.moves ?? 0;
    current.score += record.metrics?.score ?? 0;
    current.inputTokens += record.metrics?.inputTokens ?? 0;
    current.outputTokens += record.metrics?.outputTokens ?? 0;
    current.fallbacks += record.metrics?.fallbackCount ?? 0;
    current.totalLatencyMs += record.metrics?.totalModelLatencyMs ?? 0;
    current.listedCostUsd += record.estimatedCostUsd?.listedTokenRates ?? 0;
    current.conservativeCostUsd += record.estimatedCostUsd?.conservativeObservedRequestRate ?? 0;
    groups.set(key, current);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    passRate: group.scenarios ? group.passed / group.scenarios : 0,
    averageLatencyMs: group.moves ? Math.round(group.totalLatencyMs / group.moves) : null
  }));
}

export function summarizeSkillResults(records) {
  const skills = new Map();
  for (const record of records) {
    for (const skill of record.scenario?.skillTags ?? []) {
      const maxOutputTokens = record.model.parameters?.maxOutputTokens ?? null;
      const key = `${record.model.provider}:${record.model.id}:${record.model.type}:${Boolean(record.model.thinkingEnabled)}:${maxOutputTokens}:${skill}`;
      const current = skills.get(key) ?? { modelId: record.model.id, provider: record.model.provider, modelType: record.model.type, thinkingEnabled: Boolean(record.model.thinkingEnabled), maxOutputTokens, skill, attempts: 0, passed: 0 };
      current.attempts += 1;
      current.passed += record.objective?.passed ? 1 : 0;
      skills.set(key, current);
    }
  }
  return [...skills.values()].map((entry) => ({ ...entry, passRate: entry.attempts ? entry.passed / entry.attempts : 0 }));
}

export function renderChallengeReport(corpus, records) {
  const summary = summarizeChallengeRecords(records);
  const lines = [
    "# Curated Challenge Benchmark",
    "",
    `Corpus: \`${corpus.corpusId}\` v${corpus.corpusVersion} · Ruleset: \`${corpus.rulesetId}\``,
    "",
    "This fixed-board track is reported separately from deterministic seeded games.",
    "",
    "| Model | Provider | Type | Thinking | Max output | Passed | Pass rate | Moves | Score | Input tokens | Output tokens | Fallbacks | Avg latency | Conservative cost |",
    "|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|"
  ];
  for (const row of summary) {
    lines.push(`| ${row.modelId} | ${row.provider} | ${row.modelType} | ${row.thinkingEnabled ? "yes" : "no"} | ${row.maxOutputTokens ?? "n/a"} | ${row.passed}/${row.scenarios} | ${(row.passRate * 100).toFixed(1)}% | ${row.moves} | ${row.score} | ${row.inputTokens} | ${row.outputTokens} | ${row.fallbacks} | ${row.averageLatencyMs ?? "n/a"} ms | $${row.conservativeCostUsd.toFixed(4)} |`);
  }
  lines.push("", "## Scenario results", "", "| Scenario | Model | Selected | Expected | Pass | Score | Max tile | Moves |", "|---|---|---|---|---:|---:|---:|---:|");
  for (const record of records) {
    lines.push(`| ${record.scenario.scenarioId} v${record.scenario.scenarioVersion} | ${record.model.id} | ${record.objective.selectedAction ?? "none"} | ${record.objective.expectedActions.join(", ")} | ${record.objective.passed ? "yes" : "no"} | ${record.metrics.score} | ${record.metrics.maxTile} | ${record.metrics.moves} |`);
  }
  lines.push("", "## Skill results", "", "| Model | Type | Max output | Skill | Passed | Pass rate |", "|---|---|---:|---|---:|---:|");
  for (const row of summarizeSkillResults(records)) {
    lines.push(`| ${row.modelId} | ${row.modelType} | ${row.maxOutputTokens ?? "n/a"} | ${row.skill} | ${row.passed}/${row.attempts} | ${(row.passRate * 100).toFixed(1)}% |`);
  }
  return `${lines.join("\n")}\n`;
}
