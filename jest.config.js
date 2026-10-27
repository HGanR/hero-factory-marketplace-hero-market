const { selectionRegex } = require("./scripts/test-selection.cjs");
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testRegex: selectionRegex("jestNode"),
  testPathIgnorePatterns: ["/node_modules/", "\\.next/", "\\.browser\\.spec\\.(ts|tsx)$"],
  moduleNameMapper: {
    // Same marker mapping as Next.js's own Jest preset; not an application mock.
    "^server-only$": require.resolve("next/dist/build/jest/__mocks__/empty.js"),
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.(t|j)sx?$": ["ts-jest", { tsconfig: "tsconfig.jest.json" }],
  },
  transformIgnorePatterns: ["/node_modules/(?!(three)/)", "\\.next/"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
};
