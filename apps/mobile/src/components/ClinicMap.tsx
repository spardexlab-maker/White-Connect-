import { useState } from 'react';
import { Image, Linking, Platform, Pressable, View } from 'react-native';
import { MapPin, Navigation } from 'lucide-react-native';
import { directionsUrl, type LatLng } from '@app/shared';
import { Button, Row, Text } from './ui';
import { color, radius } from '../theme';

const TILE = 256, Z = 16, H = 200;
// OpenStreetMap asks apps to identify themselves when they load tiles
const TILE_HEADERS = { 'User-Agent': 'WhiteConnect/0.7 (+https://white.spardexlab.site)' };

/** Where on the z-level world map (in pixels) a point sits (Web Mercator). */
function worldPx({ lat, lng }: LatLng) {
  const n = 2 ** Z, r = (lat * Math.PI) / 180;
  return { x: ((lng + 180) / 360) * n * TILE, y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n * TILE };
}

/** Phone's own navigation: Android offers every map app (Google Maps, Waze…), iPhone opens Apple Maps. */
export function openDirections(p: LatLng, name: string) {
  const native = Platform.OS === 'android' ? `geo:0,0?q=${p.lat},${p.lng}(${encodeURIComponent(name)})`
    : Platform.OS === 'ios' ? `maps://?daddr=${p.lat},${p.lng}&q=${encodeURIComponent(name)}` : directionsUrl(p);
  Linking.openURL(native).catch(() => void Linking.openURL(directionsUrl(p)));
}

/** The clinic on a small map (map tiles drawn around the pin — no map SDK), with directions. */
export function ClinicMap({ where, name }: { where: LatLng; name: string }) {
  const [w, setW] = useState(0);
  const c = worldPx(where);
  const tiles: { x: number; y: number; left: number; top: number }[] = [];
  if (w) {
    const x0 = c.x - w / 2, y0 = c.y - H / 2;
    for (let tx = Math.floor(x0 / TILE); tx <= Math.floor((x0 + w) / TILE); tx++)
      for (let ty = Math.floor(y0 / TILE); ty <= Math.floor((y0 + H) / TILE); ty++)
        tiles.push({ x: tx, y: ty, left: tx * TILE - x0, top: ty * TILE - y0 });
  }
  return (
    <View style={{ gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`موقع ${name} على الخريطة — افتح الاتجاهات`} onPress={() => openDirections(where, name)}
                 onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}
                 style={{ height: H, borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#E8EEF2' }}>
        {tiles.map((t) => (
          <Image key={`${t.x}-${t.y}`} source={{ uri: `https://tile.openstreetmap.org/${Z}/${t.x}/${t.y}.png`, headers: TILE_HEADERS }}
                 style={{ position: 'absolute', left: t.left, top: t.top, width: TILE, height: TILE }} />
        ))}
        <View pointerEvents="none" style={{ position: 'absolute', left: w / 2 - 18, top: H / 2 - 36 }}>
          <MapPin size={36} color={color.danger} fill="#fff" strokeWidth={2.2} />
        </View>
      </Pressable>
      <Row gap={8} wrap>
        <View style={{ flex: 1 }}>
          <Button title="الاتجاهات" icon={<Navigation size={16} color={color.surface} />} onPress={() => openDirections(where, name)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="خرائط Google" variant="secondary" onPress={() => void Linking.openURL(directionsUrl(where))} />
        </View>
      </Row>
      <Text variant="small" muted>الخريطة © مساهمو OpenStreetMap</Text>
    </View>
  );
}
