const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// GLB is a binary asset, not source. Registering it lets the demo figurine be
// bundled and loaded through the same code path a provider-generated model
// takes — so the viewer is exercised for real even before a provider is
// connected.
config.resolver.assetExts.push('glb');

module.exports = config;
