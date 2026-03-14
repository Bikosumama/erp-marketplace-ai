module.exports = {
  testEnvironment: 'node',
  verbose: true,
  forceExit: true,
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[tj]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/backend/node_modules/'],
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
};