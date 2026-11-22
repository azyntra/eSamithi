// Play Console flagged android.hardware.screen.portrait (Nov 2026): the app
// locks to portrait, which makes Android infer the feature as *required* and
// hides the app from devices that do not declare it (some tablets, Chromebooks).
// Declare it explicitly as not required.
const { withAndroidManifest } = require('expo/config-plugins')

module.exports = function withPortraitNotRequired(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest
    manifest['uses-feature'] = manifest['uses-feature'] || []
    const name = 'android.hardware.screen.portrait'
    const existing = manifest['uses-feature'].find((f) => f.$ && f.$['android:name'] === name)
    if (existing) existing.$['android:required'] = 'false'
    else manifest['uses-feature'].push({ $: { 'android:name': name, 'android:required': 'false' } })
    return cfg
  })
}
