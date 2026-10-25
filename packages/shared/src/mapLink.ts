/** A clinic's place on the map, read from whatever the admin pastes: a Google / Apple Maps
 *  link, a `geo:` link or plain "33.31, 44.36". Short links (maps.app.goo.gl) carry no
 *  coordinates; the `map-link` edge function follows them and calls this on each hop. */
export interface LatLng { lat: number; lng: number }

const NUM = '(-?\\d{1,3}(?:\\.\\d+)?)';
const ok = (lat: number, lng: number): LatLng | null =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)
    ? { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 } : null;

export function parseMapLink(input: string): LatLng | null {
  let s = (input ?? '').trim();
  if (!s) return null;
  try { s = decodeURIComponent(s); } catch { /* keep as typed */ }
  const tries: RegExp[] = [
    new RegExp(`!3d${NUM}!4d${NUM}`),                                   // Google place data (the pin itself)
    new RegExp(`[?&](?:q|query|ll|sll|daddr|destination|center|mlat)=(?:loc:)?${NUM}\\s*,\\s*${NUM}`), // ?q=lat,lng …
    new RegExp(`@${NUM},${NUM}`),                                       // /@lat,lng,17z (map centre)
    new RegExp(`^geo:${NUM},${NUM}`),
    new RegExp(`^${NUM}\\s*[,،\\s]\\s*${NUM}$`),                         // "33.31, 44.36"
  ];
  for (const re of tries) {
    const m = s.match(re);
    if (m) { const p = ok(Number(m[1]), Number(m[2])); if (p) return p; }
  }
  // OpenStreetMap: ?mlat=..&mlon=..
  const lat = s.match(new RegExp(`[?&]mlat=${NUM}`)), lon = s.match(new RegExp(`[?&]mlon=${NUM}`));
  if (lat && lon) return ok(Number(lat[1]), Number(lon[1]));
  return null;
}

/** A link we must follow on the server to find the coordinates (no coordinates in it). */
export const isShortMapLink = (s: string) => /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\//i.test(s.trim());

/** OpenStreetMap's own embeddable map with a pin (no API key). */
export function mapEmbedUrl({ lat, lng }: LatLng, span = 0.006): string {
  const bbox = [lng - span, lat - span * 0.7, lng + span, lat + span * 0.7].map((n) => n.toFixed(6)).join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

/** Directions in Google Maps (opens the app on phones, the site elsewhere). */
export const directionsUrl = ({ lat, lng }: LatLng) => `https://www.google.com/maps/dir/?api=1&destination=${lat}%2C${lng}`;
export const wazeUrl = ({ lat, lng }: LatLng) => `https://waze.com/ul?ll=${lat}%2C${lng}&navigate=yes`;
