import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { CalendarDays } from 'lucide-react-native';
import { birthYears, daysInMonth, formatBirthDate, joinIsoDate, monthNamesIq, splitIsoDate, type DateParts } from '@app/shared';
import { Button, Row, Text } from './ui';
import { color, radius, space } from '../theme';

const ROW = 44;
const YEARS = birthYears();

/** Birth date chosen from three lists (day · month · year) in a bottom sheet — no typing. */
export function BirthDateField({ label = 'تاريخ الميلاد', value, onChange, optional }: {
  label?: string; value: string; onChange: (iso: string) => void; optional?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [p, setP] = useState<DateParts>(() => splitIsoDate(value));
  useEffect(() => { if (open) setP(splitIsoDate(value)); }, [open, value]);
  const ready = !!joinIsoDate(p);

  return (
    <View style={{ gap: 6 }}>
      <Text variant="label">{label}{optional ? <Text variant="label" muted> (اختياري)</Text> : null}</Text>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label}: ${formatBirthDate(value) || 'لم يُحدد'}`}
                 style={{ minHeight: 50, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, paddingHorizontal: space[3],
                          flexDirection: 'row', alignItems: 'center', gap: space[2], backgroundColor: color.surface }}>
        <CalendarDays size={18} color={color.mutedText} />
        <Text style={{ flex: 1, color: value ? color.text : color.mutedText }}>{formatBirthDate(value) || 'اختر اليوم والشهر والسنة'}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(14,30,46,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: color.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: space[4], gap: space[3] }}>
            <Text variant="h3" style={{ textAlign: 'center' }}>{label}</Text>
            <Text variant="small" muted style={{ textAlign: 'center' }}>{formatBirthDate(joinIsoDate(p)) || 'اختر اليوم والشهر والسنة'}</Text>
            <Row gap={space[2]} style={{ alignItems: 'stretch' }}>
              <Column title="اليوم" flex={0.8} items={Array.from({ length: daysInMonth(p.y, p.m) }, (_, i) => ({ v: i + 1, t: String(i + 1) }))}
                      selected={p.d} onSelect={(d) => setP({ ...p, d })} />
              <Column title="الشهر" flex={1.5} items={monthNamesIq.map((t, i) => ({ v: i + 1, t }))} selected={p.m} onSelect={(m) => setP({ ...p, m })} />
              <Column title="السنة" flex={1} items={YEARS.map((y) => ({ v: y, t: String(y) }))} selected={p.y} onSelect={(y) => setP({ ...p, y })}
                      startAt={p.y ?? 1990} />
            </Row>
            <Button title="تم" disabled={!ready} onPress={() => { onChange(joinIsoDate(p)); setOpen(false); }} />
            <Row gap={space[2]}>
              <View style={{ flex: 1 }}><Button title="إلغاء" variant="ghost" onPress={() => setOpen(false)} /></View>
              {!!value && <View style={{ flex: 1 }}><Button title="مسح التاريخ" variant="ghost" onPress={() => { onChange(''); setOpen(false); }} /></View>}
            </Row>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Column({ title, items, selected, onSelect, flex, startAt }: {
  title: string; items: { v: number; t: string }[]; selected: number | null; onSelect: (v: number) => void; flex: number; startAt?: number;
}) {
  const list = useRef<FlatList<{ v: number; t: string }>>(null);
  const first = Math.max(0, items.findIndex((it) => it.v === (selected ?? startAt)));
  return (
    <View style={{ flex, gap: 4 }}>
      <Text variant="small" muted style={{ textAlign: 'center' }}>{title}</Text>
      <FlatList ref={list} data={items} keyExtractor={(it) => String(it.v)} style={{ height: ROW * 5, borderRadius: radius.md, backgroundColor: color.surfaceSunken }}
                getItemLayout={(_, i) => ({ length: ROW, offset: ROW * i, index: i })} initialScrollIndex={Math.max(0, first - 2)}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const on = item.v === selected;
                  return (
                    <Pressable onPress={() => onSelect(item.v)} accessibilityRole="button" accessibilityState={{ selected: on }}
                               style={{ height: ROW, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4, borderRadius: 10,
                                        backgroundColor: on ? color.accent : 'transparent' }}>
                      <Text weight={on ? 'semibold' : 'regular'} style={{ color: on ? '#fff' : color.text }}>{item.t}</Text>
                    </Pressable>
                  );
                }} />
    </View>
  );
}
