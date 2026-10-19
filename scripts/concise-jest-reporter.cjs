"use strict";

function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function formatJestSummary(results) {
  const suiteTotal = results.numTotalTestSuites ?? 0;
  const suiteFailed = results.numFailedTestSuites ?? 0;
  const suitePassed = results.numPassedTestSuites ?? 0;
  const testTotal = results.numTotalTests ?? 0;
  const testFailed = results.numFailedTests ?? 0;
  const testPassed = results.numPassedTests ?? 0;
  const testPending = results.numPendingTests ?? 0;
  const success = suiteFailed === 0 && testFailed === 0 && !results.wasInterrupted;
  const status = success ? "PASS" : "FAIL";

  return [
    `${status}: ${plural(suitePassed, "suite")} passed, ${plural(suiteFailed, "suite")} failed, ${plural(suiteTotal, "suite")} total`,
    `Tests: ${plural(testPassed, "test")} passed, ${plural(testFailed, "test")} failed, ${plural(testPending, "test")} skipped, ${plural(testTotal, "test")} total`
  ].join("\n");
}

class ConciseJestReporter {
  onRunComplete(_contexts, results) {
    for (const suite of results.testResults ?? []) {
      if (suite.failureMessage) {
        process.stderr.write(`\nFAIL ${suite.testFilePath}\n${suite.failureMessage.trim()}\n`);
      }
    }

    const output = `${formatJestSummary(results)}\n`;
    const success = results.numFailedTestSuites === 0 &&
      results.numFailedTests === 0 &&
      !results.wasInterrupted;
    (success ? process.stdout : process.stderr).write(output);
  }
}

module.exports = ConciseJestReporter;
module.exports.formatJestSummary = formatJestSummary;
