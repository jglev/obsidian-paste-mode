module.exports = {
  transform: {
    "^.+\\.ts?$": "ts-jest",
  },
  testEnvironment: "jsdom",
  // testRegex: "__tests__/.*\\.test?\\.ts$",
  testMatch: ["**/__tests__/*.ts"],
  moduleFileExtensions: ["ts", "js"],
};
