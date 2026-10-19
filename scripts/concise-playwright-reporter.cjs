"use strict";

function formatPlaywrightSummary(counts, status) {
  return [
    `${status === "passed" ? "PASS" : "FAIL"}: ${counts.passed} passed, ${counts.failed} failed, ${counts.skipped} skipped, ${counts.total} total`,
    `Run status: ${status}`
  ].join("\n");
}

class ConcisePlaywrightReporter {
  constructor() {
    this.counts = { passed: 0, failed: 0, skipped: 0, total: 0 };
    this.failures = [];
  }

  printsToStdio() {
    return true;
  }

  onTestEnd(test, result) {
    this.counts.total += 1;
    if (result.status === "passed") {
      this.counts.passed += 1;
      return;
    }
    if (result.status === "skipped") {
      this.counts.skipped += 1;
      return;
    }

    this.counts.failed += 1;
    const location = test.location
      ? `${test.location.file}:${test.location.line}:${test.location.column}`
      : "unknown location";
    const errors = (result.errors ?? [])
      .map((error) => error.stack || error.message || String(error))
      .join("\n");
    this.failures.push(`${test.titlePath().join(" > ")} (${location})\n${errors}`.trim());
  }

  onEnd(result) {
    if (this.failures.length > 0) {
      process.stderr.write(`\n${this.failures.join("\n\n")}\n`);
    }
    const output = `${formatPlaywrightSummary(this.counts, result.status)}\n`;
    (result.status === "passed" ? process.stdout : process.stderr).write(output);
  }
}

module.exports = ConcisePlaywrightReporter;
module.exports.formatPlaywrightSummary = formatPlaywrightSummary;
