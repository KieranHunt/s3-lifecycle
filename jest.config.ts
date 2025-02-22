import type { Config } from "jest";

export default async (): Promise<Config> => {
  return {
    testEnvironment: "node",
    roots: ["<rootDir>"],
    testMatch: ["**/*.test.ts"],
    transform: {
      "^.+\\.tsx?$": "ts-jest",
    },
  };
};
