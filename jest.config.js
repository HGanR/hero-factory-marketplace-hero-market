/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.spec.ts", "**/*.spec.tsx"],
  testPathIgnorePatterns: ["/node_modules/", "\\.next/", "\\.browser\\.spec\\.(ts|tsx)$"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.(t|j)sx?$": ["ts-jest", { tsconfig: "tsconfig.json" }],
  },
  transformIgnorePatterns: ["/node_modules/(?!(three)/)", "\\.next/"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
};
