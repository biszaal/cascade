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
//
// The lock must not become an install requirement. Play reads screenOrientation="portrait" as
// an implied <uses-feature android:name="android.hardware.screen.portrait" required="true">,
// and devices that don't report that feature (Chromebooks, Play Games on PC, Android XR, some
// tablets) are then refused the install, which Play Console blocks review over. Declaring the
// feature explicitly with required="false" keeps the phone lock and drops the filter.
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const PORTRAIT_FEATURE = 'android.hardware.screen.portrait';

module.exports = function withAndroidPortrait(config) {
  return withAndroidManifest(config, (mod) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    activity.$['android:screenOrientation'] = 'portrait';

    const manifest = mod.modResults.manifest;
    const features = manifest['uses-feature'] ?? [];
    const existing = features.find((f) => f.$?.['android:name'] === PORTRAIT_FEATURE);
    if (existing) existing.$['android:required'] = 'false';
    else features.push({ $: { 'android:name': PORTRAIT_FEATURE, 'android:required': 'false' } });

    // Rebuild the key order so <uses-feature> is written before <application>, where the
    // manifest schema puts it (xml2js writes children in object key order).
    const { application, ...rest } = manifest;
    delete rest['uses-feature'];
    mod.modResults.manifest = { ...rest, 'uses-feature': features, application };

    return mod;
  });
};
