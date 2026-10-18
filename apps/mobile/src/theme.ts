import { Platform } from 'react-native';
import { color, font, radius, space } from '@app/shared';

export { color, radius, space };

/** IBM Plex Sans Arabic per weight (React Native needs one family per weight). */
export const family = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
} as const;

export const size = font.size;

/**
 * Text alignment at the reading start (right in Arabic). Native RTL swaps
 * 'left'→right automatically; the web preview needs the literal side.
 */
export const startAlign = Platform.OS === 'web' ? ('right' as const) : ('left' as const);

export const shadow = Platform.select({
  web: { boxShadow: '0 1px 2px rgba(21,37,54,0.06)' },
  default: { shadowColor: '#152536', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
});
