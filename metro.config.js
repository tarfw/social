const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enable package exports to resolve subpath imports like multiformats/cjs/src/cid.js
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
