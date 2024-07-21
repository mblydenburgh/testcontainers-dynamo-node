module.exports = {
  roots: ['<rootDir>'],
  verbose: true,
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
  globals: {
    'ts-jest': {
      tsConfig: 'tsconfig.json',
    },
  },
  testEnvironment: 'node',
  reporters: ['default'],
}

