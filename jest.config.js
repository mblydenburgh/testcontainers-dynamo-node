module.exports = {
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  verbose: true,
  globals: {
    "ts-jest": {
      tsConfig: "tsconfig.json",
    },
  },
  testEnvironment: "node",
  reporters: ["default"],
}

