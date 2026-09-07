module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { reanimated: false }]],
    // Must be listed last. Reanimated 4 ships its worklet transform via react-native-worklets.
    plugins: ['react-native-worklets/plugin'],
  };
};
