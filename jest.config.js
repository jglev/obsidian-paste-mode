export default {
  transform: {
    "^.+\\.ts?$": "ts-jest",
  },
  testEnvironment: "node",
  testMatch: ["**/__tests__/*.ts"],
  moduleFileExtensions: ["ts", "js"],
  maxWorkers: 1,
  globalSetup: 'obsidian-integration-testing/jest-global-setup-plugin',
  globalTeardown: 'obsidian-integration-testing/jest-global-teardown-plugin',
  setupFiles: ['obsidian-integration-testing/jest-setup'],
};
