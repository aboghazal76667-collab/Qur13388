const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// GLB garment assets. Metro treats unknown extensions as source, so without
// this the 3D garment cannot be require()'d and bundled. See
// docs/REAL_3D_RENDERER_DECISION.md.
config.resolver.assetExts = [...config.resolver.assetExts, 'glb', 'gltf'];

module.exports = config;
