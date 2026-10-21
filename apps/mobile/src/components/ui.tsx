import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Animated, Easing, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text as RNText, TextInput, View,
  type PressableProps, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { AlertTriangle, CheckCircle2, Info, OctagonAlert, RefreshCw } from 'lucide-react-native';
import { appointmentStatus, errorMessage, type AppointmentStatus } from '@app/shared';
import { color, family, radius, shadow, size, space, startAlign } from '../theme';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
const toneColors: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: color.mutedText, bg: color.surfaceSunken },
  success: { fg: color.success, bg: color.successSoft },
  warning: { fg: color.warningText, bg: color.warningSoft },
  danger: { fg: color.danger, bg: color.dangerSoft },
  info: { fg: color.information, bg: color.informationSoft },
  accent: { fg: color.accent, bg: color.accentSoft },
};

/* ---------------- text ---------------- */
type TextVariant = 'body' | 'small' | 'label' | 'h1' | 'h2' | 'h3' | 'title';
export function Text({ variant = 'body', muted, weight, ltr, style, ...rest }: TextProps & {
  variant?: TextVariant; muted?: boolean; weight?: keyof typeof family; ltr?: boolean;
}) {
  const v = textVariants[variant];
  return (
    <RNText
      {...rest}
      style={[
        { color: muted ? color.mutedText : color.text, textAlign: startAlign, writingDirection: ltr ? 'ltr' : 'rtl' },
        v, weight && { fontFamily: family[weight] }, style,
      ]}
    />
  );
}
const textVariants: Record<TextVariant, TextStyle> = {
  body: { fontFamily: family.regular, fontSize: size.body, lineHeight: size.body * 1.7 },
  small: { fontFamily: family.regular, fontSize: size.small, lineHeight: size.small * 1.6 },
  label: { fontFamily: family.medium, fontSize: size.label, lineHeight: size.label * 1.5 },
  title: { fontFamily: family.semibold, fontSize: size.bodyLg, lineHeight: size.bodyLg * 1.5 },
  h3: { fontFamily: family.semibold, fontSize: size.h3, lineHeight: size.h3 * 1.35 },
  h2: { fontFamily: family.bold, fontSize: size.h2, lineHeight: size.h2 * 1.35 },
  h1: { fontFamily: family.bold, fontSize: size.h1, lineHeight: size.h1 * 1.35 },
};

/** Codes, numbers and Latin names inside Arabic text. */
export function Ltr({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <RNText style={[{ writingDirection: 'ltr', fontFamily: family.medium }, style]}>{'⁦'}{children}{'⁩'}</RNText>;
}

/* ---------------- layout ---------------- */
export function Screen({ children, refreshing, onRefresh, footer, padded = true }: {
  children: ReactNode; refreshing?: boolean; onRefresh?: () => void; footer?: ReactNode; padded?: boolean;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: color.canvas }}>
      <ScrollView
        contentContainerStyle={[padded && { padding: space[4] }, { gap: space[4], paddingBottom: space[8] }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={color.accent} /> : undefined}
      >
        {children}
      </ScrollView>
      {footer && <View style={s.footer}>{footer}</View>}
    </View>
  );
}

export function Card({ children, style, flush }: { children: ReactNode; style?: StyleProp<ViewStyle>; flush?: boolean }) {
  return <View style={[s.card, flush && { padding: 0 }, style]}>{children}</View>;
}

export function Row({ children, style, gap = space[2], wrap, between }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number; wrap?: boolean; between?: boolean;
}) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, wrap && { flexWrap: 'wrap' }, between && { justifyContent: 'space-between' }, style]}>{children}</View>;
}

export function Stack({ children, gap = space[3], style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: color.border }} />;
}

/* ---------------- controls ---------------- */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, small, block, accessibilityLabel }: {
  title: string; onPress?: PressableProps['onPress']; variant?: ButtonVariant; icon?: ReactNode; loading?: boolean;
  disabled?: boolean; small?: boolean; block?: boolean; accessibilityLabel?: string;
}) {
  const v = buttonVariants[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        s.btn, small && s.btnSmall, block && { alignSelf: 'stretch' },
        { backgroundColor: v.bg, borderColor: v.border }, pressed && !off && { opacity: 0.85 }, off && { opacity: 0.5 },
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={v.fg} /> : icon}
      <RNText style={{ color: v.fg, fontFamily: family.semibold, fontSize: small ? size.small : size.body }}>{title}</RNText>
    </Pressable>
  );
}
const buttonVariants: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: color.primary, fg: color.surface, border: color.primary },
  accent: { bg: color.accent, fg: color.surface, border: color.accent },
  secondary: { bg: color.surface, fg: color.primary, border: color.borderStrong },
  ghost: { bg: 'transparent', fg: color.primary, border: 'transparent' },
  danger: { bg: color.danger, fg: color.surface, border: color.danger },
};

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected }} onPress={onPress}
               style={[s.chip, selected && { backgroundColor: color.primary, borderColor: color.primary }]}>
      {icon}
      <RNText style={{ fontFamily: family.medium, fontSize: size.small, color: selected ? color.surface : color.text }}>{label}</RNText>
    </Pressable>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; icon?: ReactNode }[] }) {
  return (
    <View style={s.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable key={o.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.id)}
                     style={[s.segment, on && { backgroundColor: color.surface, ...shadow }]}>
            {o.icon}
            <RNText style={{ fontFamily: on ? family.semibold : family.medium, fontSize: size.small, color: on ? color.primary : color.mutedText }}>{o.label}</RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, hint, error, optional, ltr, style, ...rest }: TextInputProps & {
  label: string; hint?: string; error?: string; optional?: boolean; ltr?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label">{label}{optional ? <RNText style={{ color: color.mutedText }}> (اختياري)</RNText> : null}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={color.mutedText}
        {...rest}
        style={[s.input, ltr ? { textAlign: 'left', writingDirection: 'ltr' } : { textAlign: startAlign }, !!error && { borderColor: color.danger }, style]}
      />
      {error ? <Text variant="small" style={{ color: color.danger }}>{error}</Text> : hint ? <Text variant="small" muted>{hint}</Text> : null}
    </View>
  );
}

/* ---------------- feedback ---------------- */
export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: ReactNode }) {
  const t = toneColors[tone];
  return (
    <View style={[s.badge, { backgroundColor: t.bg }]}>
      {icon}
      <RNText style={{ color: t.fg, fontFamily: family.medium, fontSize: size.label }}>{label}</RNText>
    </View>
  );
}

export function AppointmentBadge({ status }: { status: AppointmentStatus }) {
  const st = appointmentStatus[status];
  return <Badge label={st.label} tone={st.tone as Tone} />;
}

export function Alert({ tone = 'info', title, children, action }: { tone?: Exclude<Tone, 'neutral' | 'accent'>; title?: string; children?: ReactNode; action?: ReactNode }) {
  const t = toneColors[tone];
  const Icon = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: OctagonAlert }[tone];
  return (
    <View style={[s.alert, { backgroundColor: t.bg }]} accessibilityRole={tone === 'danger' ? 'alert' : undefined}>
      <Icon size={20} color={t.fg} />
      <View style={{ flex: 1, gap: 4 }}>
        {title && <Text variant="title" style={{ color: t.fg, fontSize: size.body }}>{title}</Text>}
        {typeof children === 'string' ? <Text variant="small" style={{ color: color.text }}>{children}</Text> : children}
        {action}
      </View>
    </View>
  );
}

export function Loading({ label = 'جارٍ التحميل…' }: { label?: string }) {
  return (
    <View style={{ padding: space[6], alignItems: 'center', gap: space[2] }} accessibilityLiveRegion="polite">
      <ActivityIndicator color={color.accent} />
      <Text variant="small" muted>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', padding: space[6], gap: space[2] }}>
      {icon && <View style={s.emptyIcon}>{icon}</View>}
      <Text variant="title" style={{ textAlign: 'center' }}>{title}</Text>
      {typeof children === 'string' ? <Text variant="small" muted style={{ textAlign: 'center' }}>{children}</Text> : children}
      {action && <View style={{ marginTop: space[2] }}>{action}</View>}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <EmptyState icon={<OctagonAlert size={28} color={color.danger} />} title="تعذّر التحميل"
                action={onRetry && <Button title="إعادة المحاولة" variant="secondary" small icon={<RefreshCw size={16} color={color.primary} />} onPress={onRetry} />}>
      {errorMessage(error)}
    </EmptyState>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <Row between>
      <Text variant="h3" style={{ fontSize: 18 }}>{children}</Text>
      {action}
    </Row>
  );
}

/** Label/value rows (review screens, receipts). */
export function Summary({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <View style={{ gap: space[2] }}>
      {rows.map(([k, v]) => (
        <View key={k} style={{ flexDirection: 'row', gap: space[3], alignItems: 'flex-start' }}>
          <Text variant="small" muted style={{ width: 92 }}>{k}</Text>
          <View style={{ flex: 1 }}>{typeof v === 'string' ? <Text variant="small" weight="medium">{v}</Text> : v}</View>
        </View>
      ))}
    </View>
  );
}

export function Avatar({ name, large, src }: { name: string; large?: boolean; src?: string | null }) {
  const initials = name.replace(/^(د\.|دكتور|الدكتور|مختبر)\s*/u, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join(' ');
  const d = large ? 64 : 48;
  if (src) return <Image source={{ uri: src }} style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: color.accentSoft }} accessibilityIgnoresInvertColors />;
  return (
    <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no">
      <RNText style={{ fontFamily: family.bold, color: color.accent, fontSize: large ? 20 : 16 }}>{initials}</RNText>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, padding: space[4], gap: space[3], ...shadow },
  footer: { borderTopWidth: 1, borderColor: color.border, backgroundColor: color.surface, padding: space[3], paddingBottom: space[4] },
  btn: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space[4], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2] },
  btnSmall: { minHeight: 40, paddingHorizontal: space[3] },
  chip: { minHeight: 40, paddingHorizontal: space[3], borderRadius: radius.pill, borderWidth: 1, borderColor: color.border, backgroundColor: color.surface, flexDirection: 'row', alignItems: 'center', gap: 6 },
  segmented: { flexDirection: 'row', backgroundColor: color.surfaceSunken, borderRadius: radius.md, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 40, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  input: { minHeight: 48, borderWidth: 1, borderColor: color.borderStrong, borderRadius: radius.md, paddingHorizontal: space[3], backgroundColor: color.surface, fontFamily: family.regular, fontSize: size.bodyLg, color: color.text },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  alert: { flexDirection: 'row', gap: space[3], padding: space[3], borderRadius: radius.md, alignItems: 'flex-start' },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: color.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
});

/* ---------------- motion (calm, transform/opacity only, honours Reduce Motion) ---------------- */
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

/** Fade + slight rise on mount; `index` staggers the first few items only. */
export function FadeIn({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) { v.setValue(1); return; }
    Animated.timing(v, { toValue: 1, duration: 240, delay: Math.min(index, 5) * 40, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [reduce, index, v]);
  return <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }, style]}>{children}</Animated.View>;
}

/** Pressable that scales slightly while pressed. */
export function PressScale({ children, onPress, style, accessibilityLabel, accessibilityRole = 'button', selected }: {
  children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; accessibilityLabel?: string; accessibilityRole?: 'button' | 'link'; selected?: boolean;
}) {
  const v = useRef(new Animated.Value(1)).current;
  const to = (x: number) => Animated.timing(v, { toValue: x, duration: 120, useNativeDriver: true }).start();
  return (
    <Pressable onPress={onPress} onPressIn={() => to(0.97)} onPressOut={() => to(1)} accessibilityRole={accessibilityRole}
               accessibilityLabel={accessibilityLabel} accessibilityState={selected === undefined ? undefined : { selected }}>
      <Animated.View style={[style, { transform: [{ scale: v }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function SkeletonBox({ width = '100%', height = 14, radius: r = 8, style }: { width?: number | `${number}%`; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.55, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduce, v]);
  return <Animated.View style={[{ width, height, borderRadius: r, backgroundColor: color.surfaceSunken, opacity: v }, style]} accessibilityElementsHidden />;
}

/** Check mark that pops in — render only after the server confirmed. */
export function SuccessMark({ pending }: { pending?: boolean }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(reduce ? 1 : 0.6)).current;
  useEffect(() => { if (!reduce) Animated.spring(v, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start(); }, [reduce, v]);
  const tone = pending ? toneColors.warning : toneColors.success;
  return (
    <Animated.View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center', transform: [{ scale: v }] }}>
      <CheckCircle2 size={36} color={tone.fg} />
    </Animated.View>
  );
}
