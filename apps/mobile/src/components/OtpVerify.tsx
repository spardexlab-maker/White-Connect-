import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Check } from 'lucide-react-native';
import { iraqiLocal } from '@app/shared';
import { Text } from './ui';
import { useReduceMotion } from './ui';

type Stage = 'enter' | 'scatter' | 'verifying' | 'granted';
const LEN = 6;
const BRIGHT = '#5EEAD4', TEAL = '#14B8A6';
// where each box flies when the code is complete
const FLY = [[-90, -40, -38], [-55, 55, 24], [-15, -70, -18], [20, 70, 30], [60, -50, -26], [95, 40, 40]];

/**
 * The 6-digit WhatsApp code: one box per digit (one hidden field underneath, so the
 * phone's code autofill works); complete → the boxes fly apart → a ring fills while the
 * server checks → check mark, or the boxes shake back with the error.
 */
export function OtpVerify({ phone, submit, onDone, onResend, resendIn, onChangeNumber }: {
  phone: string; submit: (code: string) => Promise<string | null>; onDone: () => void;
  onResend: () => void; resendIn: number; onChangeNumber: () => void;
}) {
  const reduce = useReduceMotion();
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<Stage>('enter');
  const [error, setError] = useState<string | null>(null);
  const [pct, setPct] = useState(0);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const fly = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => { if (stage === 'enter') setTimeout(() => input.current?.focus(), 50); }, [stage]);

  const run = async (value: string) => {
    setError(null); setStage('scatter'); input.current?.blur();
    if (!reduce) await new Promise((r) => Animated.timing(fly, { toValue: 1, duration: 600, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(r));
    setStage('verifying'); setPct(0);
    const t0 = Date.now();
    const timer = setInterval(() => setPct(Math.min(90, 90 * (1 - Math.exp(-(Date.now() - t0) / 700)))), 50);
    const [err] = await Promise.all([submit(value), new Promise((r) => setTimeout(r, reduce ? 0 : 900))]);
    clearInterval(timer);
    if (err) {
      fly.setValue(0); setCode(''); setError(err); setStage('enter');
      if (!reduce) Animated.sequence([-8, 8, -8, 8, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 70, useNativeDriver: true }))).start();
      return;
    }
    setPct(100);
    await new Promise((r) => setTimeout(r, reduce ? 0 : 300));
    setStage('granted');
    if (!reduce) Animated.spring(pop, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start(); else pop.setValue(1);
    setTimeout(() => done.current(), reduce ? 300 : 1300);
  };

  const onType = (t: string) => {
    const v = t.replace(/\D/g, '').slice(0, LEN);
    setCode(v); setError(null);
    if (v.length === LEN) void run(v);
  };

  const R = 34, C = 2 * Math.PI * R;
  return (
    <View style={[s.card, stage === 'granted' && s.cardGranted]} accessibilityLiveRegion="polite">
      <View style={s.head}>
        <Text weight="bold" style={s.title}>{stage === 'granted' ? 'تم التحقق' : stage === 'verifying' ? 'جارٍ التحقق…' : 'أدخل رمز الدخول'}</Text>
        <Text variant="small" style={s.sub}>
          {stage === 'granted' ? 'أهلاً بك، جارٍ فتح حسابك…' : stage === 'verifying' ? 'نتأكد من الرمز بأمان' : `بعثنا رمزاً من 6 أرقام على واتساب \u2066${iraqiLocal(phone)}\u2069`}
        </Text>
      </View>

      <View style={s.stage}>
        {(stage === 'enter' || stage === 'scatter') && (
          <Pressable onPress={() => input.current?.focus()} accessibilityLabel="رمز الدخول من 6 أرقام">
            <Animated.View style={[s.boxes, { transform: [{ translateX: shake }] }]}>
              {Array.from({ length: LEN }, (_, i) => {
                const [tx, ty, rot] = FLY[i];
                const active = stage === 'enter' && i === Math.min(code.length, LEN - 1);
                return (
                  <Animated.View key={i} style={[s.box, code[i] ? s.boxFilled : null, active ? s.boxActive : null, {
                    opacity: fly.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 1, 0] }),
                    transform: [
                      { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [0, tx] }) },
                      { translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [0, ty] }) },
                      { rotate: fly.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${rot}deg`] }) },
                      { scale: fly.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 1.04, 0.5] }) },
                    ],
                  }]}>
                    <Text weight="bold" style={s.digit}>{code[i] ?? ''}</Text>
                  </Animated.View>
                );
              })}
            </Animated.View>
            <TextInput ref={input} value={code} onChangeText={onType} keyboardType="number-pad" maxLength={LEN} autoComplete="sms-otp"
                       textContentType="oneTimeCode" editable={stage === 'enter'} caretHidden style={s.hidden} accessibilityLabel="رمز الدخول" />
          </Pressable>
        )}
        {stage === 'verifying' && (
          <View style={s.ringWrap} accessibilityLabel={`جارٍ التحقق ${Math.round(pct)}٪`}>
            <Svg width={92} height={92} viewBox="0 0 92 92">
              <Circle cx={46} cy={46} r={R} stroke="rgba(255,255,255,0.12)" strokeWidth={6} fill="none" />
              <Circle cx={46} cy={46} r={R} stroke={BRIGHT} strokeWidth={6} fill="none" strokeLinecap="round"
                      strokeDasharray={`${C}`} strokeDashoffset={C * (1 - pct / 100)} transform="rotate(-90 46 46)" />
            </Svg>
            <Text weight="bold" style={s.pct}>{Math.round(pct)}</Text>
          </View>
        )}
        {stage === 'granted' && (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Animated.View style={[s.check, { transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }], opacity: pop }]}>
              <Check size={30} color="#053B35" strokeWidth={3} />
            </Animated.View>
            <Animated.View style={[s.pill, { opacity: pop }]}><Text weight="bold" style={s.pillTxt}>تم التحقق</Text></Animated.View>
          </View>
        )}
      </View>

      {error && stage === 'enter' && <Text variant="small" style={s.error} accessibilityRole="alert">{error}</Text>}
      {stage === 'enter' && (
        <View style={s.foot}>
          <Pressable onPress={onChangeNumber} accessibilityRole="button"><Text weight="semibold" style={s.link}>تغيير الرقم</Text></Pressable>
          <Pressable onPress={onResend} disabled={resendIn > 0} accessibilityRole="button">
            <Text weight="semibold" style={[s.link, resendIn > 0 && s.linkOff]}>{resendIn > 0 ? `إعادة الإرسال بعد ${resendIn} ث` : 'لم يصلك؟ أعد الإرسال'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#123355', borderRadius: 20, paddingVertical: 24, paddingHorizontal: 16, gap: 16, alignItems: 'center', overflow: 'hidden',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  cardGranted: { borderColor: 'rgba(94,234,212,0.4)' },
  head: { alignItems: 'center', gap: 4 },
  title: { color: '#fff', fontSize: 18 },
  sub: { color: '#A9BFD1', textAlign: 'center' },
  stage: { minHeight: 110, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  boxes: { flexDirection: 'row', direction: 'ltr', gap: 8, justifyContent: 'center' },
  box: { width: 44, height: 54, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(255,255,255,0.06)',
         alignItems: 'center', justifyContent: 'center' },
  boxFilled: { borderColor: 'rgba(94,234,212,0.6)' },
  boxActive: { borderColor: BRIGHT, shadowColor: BRIGHT, shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  digit: { color: '#fff', fontSize: 22 },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  ringWrap: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center' },
  pct: { position: 'absolute', color: '#fff', fontSize: 17 },
  check: { width: 64, height: 64, borderRadius: 32, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center',
           shadowColor: BRIGHT, shadowOpacity: 0.6, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
  pill: { backgroundColor: TEAL, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 3 },
  pillTxt: { color: '#042F2B', fontSize: 12 },
  error: { color: '#FFB4A8', textAlign: 'center' },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
  link: { color: BRIGHT, fontSize: 14, paddingVertical: 6 },
  linkOff: { color: '#7F97AB' },
});
