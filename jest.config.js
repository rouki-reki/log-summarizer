module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'], // Look for test files in the tests directory
  moduleNameMapper: {
    // Handle module aliases (if any)
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  // Setup files to run before each test file
  // setupFilesAfterEnv: ['./tests/setup.ts'], // Optional: if setup is needed
  // Coverage reporting
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8', // or 'babel'
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts', // Exclude server startup file from coverage
    '!src/models/**/*.ts', // Interfaces don't need coverage
    '!src/database/memoryDb.ts' // Simple DB might be excluded or tested via integration
  ],
};