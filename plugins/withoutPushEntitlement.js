// Keep the APNs push entitlement out of the iOS app.
//
// expo-notifications always writes `aps-environment` into the entitlements, because most apps
// that use it receive remote pushes. Cascade does not: its daily reminder is a local
// notification, scheduled and delivered by the phone itself, which needs no entitlement. The
// privacy policy says so too ("there is no push server").
//
// Leaving it in costs more than it looks. The entitlement requires the Push Notifications
// capability on the App ID and in the provisioning profile, and EAS can only add that with an
// interactive Apple login - a non-interactive build fails at signing instead.
//
// Order matters: a plugin's mod runs after the mods of plugins listed later in app.json, so this
// must be listed BEFORE "expo-notifications" to see, and remove, what it added.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['aps-environment'];
    return mod;
  });
};
