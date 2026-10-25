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
  webDsn: 'https://e0e5deddb6bb4ce0390defab3e7197f0@o4512317041737728.ingest.de.sentry.io/4512317063561296',
  mobileDsn: 'https://94ed1f0d652fb079a2c49de6b7129d90@o4512317041737728.ingest.de.sentry.io/4512318432870480',
} as const;
