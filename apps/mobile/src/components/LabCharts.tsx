import { View } from 'react-native';
import Svg, { Circle, G, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { chartDomain, formatDateShort, rangePosition, rangePositionLabel, type NumRange } from '@app/shared';
import { Text } from './ui';
import { color } from '../theme';

const posColor = (p: string) => (p === 'within' ? color.success : color.warningText);

/** Where a value sits against the lab's reference range (low · reference band · high). */
export function RangeBar({ value, range }: { value: number; range: NumRange }) {
  const [lo, hi] = chartDomain([value], range);
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
  const pos = rangePosition(value, range);
  const a = range.low != null ? pct(range.low) : 0;
  const b = range.high != null ? pct(range.high) : 100;
  return (
    <View accessible accessibilityLabel={`${value}: ${rangePositionLabel[pos]}`} style={{ gap: 4 }}>
      <View style={{ height: 10, borderRadius: 999, backgroundColor: color.warningSoft, direction: 'ltr' }}>
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: `${a}%`, width: `${b - a}%`, backgroundColor: '#BFE3CB', borderRadius: 999 }} />
        <View style={{ position: 'absolute', top: -4, left: `${pct(value)}%`, marginLeft: -9, width: 18, height: 18, borderRadius: 9,
                       backgroundColor: posColor(pos), borderWidth: 3, borderColor: color.surface }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', direction: 'ltr' }}>
        <Text variant="small" muted>{range.low ?? ''}</Text>
        <Text variant="small" style={{ color: posColor(pos), fontWeight: '600' }}>{rangePositionLabel[pos]}</Text>
        <Text variant="small" muted>{range.high ?? ''}</Text>
      </View>
    </View>
  );
}

interface Pt { value_numeric: number | null; released_at: string }

/** Values over time (oldest → newest, left to right) with the reference band shaded. */
export function TrendChart({ points, range }: { points: Pt[]; range: NumRange | null }) {
  const pts = points.filter((p) => p.value_numeric != null).slice().reverse();
  if (pts.length < 2) return null;
  const W = 320, H = 120, L = 34, R = 12, T = 12, B = 22;
  const vals = pts.map((p) => Number(p.value_numeric));
  const [lo, hi] = chartDomain(vals, range);
  const x = (i: number) => L + (i * (W - L - R)) / (pts.length - 1);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const top = y(range?.high ?? hi), bottom = y(range?.low ?? lo);
  return (
    <View accessible accessibilityLabel={`تطور النتيجة: ${vals.join('، ')}`} style={{ direction: 'ltr' }}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {range && <Rect x={L} y={top} width={W - L - R} height={Math.max(0, bottom - top)} fill="#E3F3E8" />}
        {[lo, hi].map((v, i) => <SvgText key={i} x={L - 6} y={y(v) + 4} fontSize={10} fill={color.mutedText} textAnchor="end">{String(Math.round(v * 10) / 10)}</SvgText>)}
        <Polyline points={pts.map((p, i) => `${x(i)},${y(Number(p.value_numeric))}`).join(' ')} fill="none" stroke={color.primary} strokeWidth={2} />
        {pts.map((p, i) => {
          const pos = range ? rangePosition(Number(p.value_numeric), range) : 'within';
          return (
            <G key={i}>
              <Circle cx={x(i)} cy={y(Number(p.value_numeric))} r={4.5} fill={posColor(pos)} stroke={color.surface} strokeWidth={2} />
              <SvgText x={x(i)} y={y(Number(p.value_numeric)) - 8} fontSize={11} fontWeight="700" fill={color.text} textAnchor="middle">{String(Number(p.value_numeric))}</SvgText>
              <SvgText x={x(i)} y={H - 6} fontSize={10} fill={color.mutedText} textAnchor="middle">{formatDateShort(p.released_at)}</SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}
