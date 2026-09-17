/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  // tsconfig.json uses `jsx: "preserve"` (required for the Next.js build).
  // Test-only .tsx files are compiled through tsconfig.jest.json instead,
  // which overrides that to `jsx: "react-jsx"` so ts-jest can turn JSX into
  // real React.createElement calls for component-rendering tests (see
  // lib/binary2048/leaderboard-view.test.tsx).
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/.claude/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1"
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.jest.json" }]
  }
};
