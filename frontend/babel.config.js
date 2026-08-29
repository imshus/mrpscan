module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // IMPORTANT: Reanimated must be last in the plugins list for release builds.
    plugins: ['react-native-reanimated/plugin'],
  };
};
