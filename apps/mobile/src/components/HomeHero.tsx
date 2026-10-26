import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { FlaskConical, Stethoscope } from 'lucide-react-native';
import { useReduceMotion, Text } from './ui';
import { color, radius, shadow, space } from '../theme';

type Kind = 'doctor' | 'laboratory';

/** A slow loop 0→1→0 that drives the hero's ambient motion (off when the system asks for reduced motion). */
function useLoop(ms: number, delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  useEffect(() => {
    if (reduce) { v.setValue(0.5); return; }
    const a = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [reduce, ms, delay, v]);
  return v;
}

/** The home screen's hero: drifting light, a breathing ring, a light sweep, the greeting, search and the doctors/labs switch. */
export function HomeHero({ greeting, name, search, kind, onKind }: {
  greeting: string; name?: string | null; search: ReactNode; kind: Kind; onKind: (k: Kind) => void;
}) {
  const reduce = useReduceMotion();
  const a = useLoop(5200);
  const b = useLoop(6800, 600);
  const ring = useLoop(3600);
  const sweep = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const wave = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) { enter.setValue(1); return; }
    Animated.timing(enter, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const s = Animated.loop(Animated.sequence([
      Animated.timing(sweep, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.delay(3200),
      Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    const w = Animated.loop(Animated.sequence([
      Animated.timing(wave, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(wave, { toValue: -1, duration: 260, useNativeDriver: true }),
      Animated.timing(wave, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(wave, { toValue: 0, duration: 260, useNativeDriver: true }),
      Animated.delay(3600),
    ]));
    s.start(); w.start();
    return () => { s.stop(); w.stop(); };
  }, [reduce, enter, sweep, wave]);

  // the doctors/labs switch: the white pill grows into the chosen tab and fades out of the other
  const thumb = useRef(new Animated.Value(kind === 'doctor' ? 0 : 1)).current;
  useEffect(() => {
    Animated.spring(thumb, { toValue: kind === 'doctor' ? 0 : 1, useNativeDriver: true, speed: 14, bounciness: 8 }).start();
  }, [kind, thumb]);

  const rise = (from: number) => ({ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] });

  return (
    <View style={h.hero}>
      <Animated.View pointerEvents="none" style={[h.glow, { transform: [
        { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [-20, 60] }) },
        { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, 40] }) },
        { scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }] }]} />
      <Animated.View pointerEvents="none" style={[h.glow2, { transform: [
        { translateX: b.interpolate({ inputRange: [0, 1], outputRange: [30, -50] }) },
        { translateY: b.interpolate({ inputRange: [0, 1], outputRange: [10, -30] }) },
        { scale: b.interpolate({ inputRange: [0, 1], outputRange: [1.1, 0.9] }) }] }]} />
      <Animated.View pointerEvents="none" style={[h.ring, {
        opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
        transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] }) }] }]} />
      <Animated.View pointerEvents="none" style={[h.ring2, { transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1.05, 0.95] }) }] }]} />
      {!reduce && (
        <Animated.View pointerEvents="none" style={[h.sweep, {
          opacity: sweep.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-260, 520] }) }, { rotate: '18deg' }] }]} />
      )}

      <Animated.View style={[{ gap: 2 }, rise(14)]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text variant="label" style={{ color: '#A9C3DA' }}>{greeting}{name ? '،' : ''}</Text>
          {!!name && <Text variant="label" weight="semibold" style={{ color: color.surface }} numberOfLines={1}>{name}</Text>}
          <Animated.Text style={{ fontSize: 16, transform: [{ rotate: wave.interpolate({ inputRange: [-1, 1], outputRange: ['-18deg', '18deg'] }) }] }}>👋</Animated.Text>
        </View>
        <Text variant="h2" style={{ color: '#fff' }}>كيف نساعدك اليوم؟</Text>
      </Animated.View>

      <Animated.View style={rise(22)}>{search}</Animated.View>

      <Animated.View style={rise(30)}>
        <View style={h.seg} accessibilityRole="tablist">
          {(['doctor', 'laboratory'] as Kind[]).map((k) => {
            const on = kind === k;
            const p = k === 'doctor' ? thumb.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) : thumb.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
            return (
              <Pressable key={k} onPress={() => onKind(k)} style={h.segBtn} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                <Animated.View pointerEvents="none" style={[h.thumb, { opacity: p, transform: [{ scaleX: p.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]} />
                <View style={{ position: 'relative', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {k === 'doctor' ? <Stethoscope size={16} color={on ? color.primary : '#CFE0EE'} /> : <FlaskConical size={16} color={on ? color.primary : '#CFE0EE'} />}
                  <Text variant="small" weight="semibold" style={{ color: on ? color.primary : '#CFE0EE' }}>{k === 'doctor' ? 'أطباء' : 'مختبرات'}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const h = StyleSheet.create({
  hero: { backgroundColor: color.primary, borderRadius: 22, padding: space[5], gap: space[4], overflow: 'hidden', ...shadow },
  glow: { position: 'absolute', top: -80, left: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(94,234,212,0.18)' },
  glow2: { position: 'absolute', bottom: -90, left: 80, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(29,95,209,0.22)' },
  ring: { position: 'absolute', bottom: -110, right: -40, width: 260, height: 260, borderRadius: 130, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  ring2: { position: 'absolute', top: -60, right: -70, width: 180, height: 180, borderRadius: 90, borderWidth: 1, borderColor: 'rgba(94,234,212,0.18)' },
  sweep: { position: 'absolute', top: -60, left: 0, width: 90, height: 420, backgroundColor: 'rgba(255,255,255,0.07)' },
  seg: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.1)' },
  thumb: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: radius.sm, backgroundColor: '#fff' },
  segBtn: { flex: 1, minHeight: 40, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
