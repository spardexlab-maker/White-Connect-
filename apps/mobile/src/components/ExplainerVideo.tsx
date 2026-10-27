import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Play } from 'lucide-react-native';
import { youtubeThumb, youtubeWatchUrl, type ExplainerVideo as Video } from '@app/shared';
import { supabase } from '../lib/supabase';
import { unwrap, useAsync } from '../lib/useAsync';
import { Text, useReduceMotion } from './ui';
import { color, radius, shadow, space } from '../theme';

/** The patient explainer film the super admin linked from YouTube; opens in the in-app browser. Hidden until a link is set. */
export function ExplainerVideo() {
  const list = useAsync(async () => ((await unwrap(supabase.rpc('explainer_videos'))) ?? []) as unknown as Video[], []);
  const v = list.data?.find((x) => x.audience === 'patient');
  const reduce = useReduceMotion();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce || !v) return;
    const a = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [reduce, v, pulse]);
  if (!v) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`تشغيل الفيديو: ${v.title}`} onPress={() => void WebBrowser.openBrowserAsync(youtubeWatchUrl(v.youtube_id))} style={s.card}>
      <View style={s.frame}>
        <Image source={{ uri: youtubeThumb(v.youtube_id) }} style={s.img} resizeMode="cover" />
        <View style={s.shade} />
        <Animated.View style={[s.ring, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }] }]} />
        <View style={s.play}><Play size={26} color="#fff" fill="#fff" /></View>
      </View>
      <View style={{ padding: space[3], gap: 2 }}>
        <Text variant="title">شلون يشتغل أبيض؟</Text>
        <Text variant="small" muted>{v.title} — فيديو قصير يشرح كل شي</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: color.surface, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: color.border, ...shadow },
  frame: { aspectRatio: 16 / 9, backgroundColor: '#0B1B2B', alignItems: 'center', justifyContent: 'center' },
  img: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  shade: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(8,23,38,0.25)' },
  ring: { position: 'absolute', width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: '#fff' },
  play: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(15,118,110,0.95)', alignItems: 'center', justifyContent: 'center' },
});
