/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {}],
  },
  moduleDirectories: ["node_modules", "src"],
  // Run tests serially to prevent file conflicts
  maxWorkers: 1,
  // Alternatively, you can use runInBand: true
  // runInBand: true,
};
