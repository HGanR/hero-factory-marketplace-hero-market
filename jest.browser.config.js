/** @type {import('jest').Config} - jsdom for export tests (FileReader, Blob) */
module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.browser.spec.ts", "**/*.browser.spec.tsx"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.(t|j)sx?$": ["ts-jest", { tsconfig: "tsconfig.json" }],
  },
  transformIgnorePatterns: ["/node_modules/(?!(three)/)", "\\.next/"],
  testPathIgnorePatterns: ["/node_modules/", "\\.next/"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
};
