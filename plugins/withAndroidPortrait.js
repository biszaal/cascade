// Lock Cascade's Android activity to portrait.
//
// iOS gets this from app.json's infoPlist: portrait on iPhone, every orientation on iPad. The
// top-level `orientation` key can't express that split, so it stays "default" for iOS and this
// plugin sets Android on its own. Without it an Android phone rotates into a landscape layout
// the screens were never designed for, and the home screen's buttons fall off the bottom.
//
// Large screens still rotate: apps targeting Android 16 (API 36) have orientation locks ignored
// on displays 600dp wide and up, which matches the iPad behaviour and is what those layouts
// were built for.
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

module.exports = function withAndroidPortrait(config) {
  return withAndroidManifest(config, (mod) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    activity.$['android:screenOrientation'] = 'portrait';
    return mod;
  });
};
