import type { Config } from "jest";

const config: Config = {
  projects: [
    {
      displayName: "unit",
      preset: "ts-jest",
      testEnvironment: "node",
      testMatch: ["<rootDir>/src/lib/__tests__/**/*.test.ts"],
      transform: { "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
      moduleNameMapper: { "^react-native$": "<rootDir>/src/__mocks__/react-native.ts" },
    },
    {
      displayName: "hooks",
      preset: "ts-jest",
      testEnvironment: "jsdom",
      testMatch: ["<rootDir>/src/hooks/__tests__/**/*.test.tsx"],
      transform: { "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
      moduleNameMapper: { "^react-native$": "<rootDir>/src/__mocks__/react-native.ts" },
    },
  ],
};

export default config;
