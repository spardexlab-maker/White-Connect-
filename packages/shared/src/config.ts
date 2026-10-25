/**
 * Central product configuration. The brand name is a placeholder until the
 * owner decides; override with VITE_PRODUCT_NAME at build time.
 */
export const productDefaults = {
  name: 'منصة الرعاية',
  nameEn: 'Care Platform',
  defaultTimezone: 'Asia/Baghdad',
  defaultCurrency: 'IQD',
  defaultLocale: 'ar',
} as const;

/** Sentry projects (crash reports). A DSN is a public address, safe in the app; empty = off.
 *  No patient data is sent: no IP, no user details, no request bodies. */
export const sentry = {
  webDsn: '',
  mobileDsn: '',
} as const;
