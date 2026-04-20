module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|firebase|@firebase|@react-native-async-storage)',
  ],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
    'firebase/**/*.{js,ts}',
    '!app/_layout.tsx',
    '!**/*.d.ts',
    '!firebase/config.js',
    '!firebase/config.example.js',
  ],
  coverageThreshold: {
    global: { lines: 70 },
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
