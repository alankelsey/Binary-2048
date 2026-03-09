/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/.claude/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1"
  }
};
