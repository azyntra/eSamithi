// Hardware Android would otherwise infer as *required*, hiding the app from
// devices without it. Each is used by part of the app only, and those parts
// cope without it:
// - android.hardware.screen.portrait (Nov 2026, 1.6.0): the app locks to
//   portrait, which hid it from some tablets and Chromebooks.
// - android.hardware.microphone (Nov 2026, 1.7.0): RECORD_AUDIO for the
//   Secretary's minutes recorder implies a microphone; Play dropped 7
//   devices (phones, tablets, a TV) that have none. Only the Secretary
//   records; everyone else just listens.
const { withAndroidManifest } = require('expo/config-plugins')

const NOT_REQUIRED = ['android.hardware.screen.portrait', 'android.hardware.microphone']

module.exports = function withPortraitNotRequired(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest
    manifest['uses-feature'] = manifest['uses-feature'] || []
    for (const name of NOT_REQUIRED) {
      const existing = manifest['uses-feature'].find((f) => f.$ && f.$['android:name'] === name)
      if (existing) existing.$['android:required'] = 'false'
      else manifest['uses-feature'].push({ $: { 'android:name': name, 'android:required': 'false' } })
    }
    return cfg
  })
}
