const { selectionRegex } = require("./scripts/test-selection.cjs");
/** @type {import('jest').Config} - jsdom for export tests (FileReader, Blob) */
module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src"],
  testRegex: selectionRegex("jestBrowser"),
  moduleNameMapper: {
    // Same marker mapping as Next.js's own Jest preset; not an application mock.
    "^server-only$": require.resolve("next/dist/build/jest/__mocks__/empty.js"),
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.(t|j)sx?$": ["ts-jest", { tsconfig: "tsconfig.jest.json" }],
  },
  transformIgnorePatterns: ["/node_modules/(?!(three)/)", "\\.next/"],
  testPathIgnorePatterns: ["/node_modules/", "\\.next/"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
};
