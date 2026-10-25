// Expo's default Metro setup, plus Sentry debug IDs so crash reports point at real source lines.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
