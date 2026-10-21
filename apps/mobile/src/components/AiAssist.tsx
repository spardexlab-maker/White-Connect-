import { useState } from 'react';
import { Linking, TextInput, View } from 'react-native';
import { FlaskConical, PhoneCall, Sparkles, Stethoscope } from 'lucide-react-native';
import { aiErrorMessage, aiTriageDisclaimer, type AiTriage } from '@app/shared';
import { supabase } from '../lib/supabase';
import { Alert, Badge, Button, Card, Row, Stack, Text } from './ui';
import { color, family, radius, size, space, startAlign } from '../theme';

/** «كيف نساعدك اليوم؟» — describe a complaint, get the specialty to visit; the parent shows the nearest ones. */
export function AiAssist({ onDoctors, onLabs }: { onDoctors: (specialtyId: string) => void; onLabs: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AiTriage | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const ask = async () => {
    if (text.trim().length < 3) { setErr('اكتب ما تشعر به بجملة قصيرة.'); return; }
    setBusy(true); setErr(null); setRes(null);
    const { data, error } = await supabase.functions.invoke('ai-triage', { body: { text: text.trim() } });
    setBusy(false);
    if (error) setErr(await aiErrorMessage(error)); else setRes(data as AiTriage);
  };

  return (
    <Card>
      <Row gap={space[2]}>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={18} color="#fff" />
        </View>
        <Stack gap={0} style={{ flex: 1 }}>
          <Text variant="title">المساعد الذكي</Text>
          <Text variant="small" muted>اكتب ما تعاني منه، ونقترح أي طبيب أو مختبر تراجع — والأقرب إليك.</Text>
        </Stack>
      </Row>
      <TextInput value={text} onChangeText={setText} multiline maxLength={600} accessibilityLabel="صف ما تشعر به"
                 placeholder="مثال: عندي صداع وتعب من أسبوع" placeholderTextColor={color.mutedText}
                 style={{ minHeight: 70, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, padding: space[3], textAlignVertical: 'top',
                          fontFamily: family.regular, fontSize: size.body, color: color.text, textAlign: startAlign }} />
      <Button title="اقترح لي" icon={<Sparkles size={16} color={color.surface} />} loading={busy} onPress={ask} block />
      <Text variant="small" muted>{aiTriageDisclaimer}</Text>
      {err && <Alert tone="warning">{err}</Alert>}
      {res && (
        <Stack gap={space[2]}>
          {res.emergency && (
            <Alert tone="danger" title="توجّه فوراً لأقرب طوارئ"
                   action={<Button small variant="danger" title="اتصل 122" icon={<PhoneCall size={14} color={color.surface} />} onPress={() => Linking.openURL('tel:122')} />}>
              {res.emergency_reason} لا تنتظر موعداً — اتصل بالإسعاف أو اذهب لأقرب مستشفى.
            </Alert>
          )}
          {(res.specialty || res.suggested_specialty) ? (
            <Text>التخصص المقترح: <Text weight="semibold">{res.suggested_specialty || res.specialty?.name}</Text>
              {res.specialty && res.suggested_specialty && res.specialty.name !== res.suggested_specialty ? <Text variant="small" muted>{`  (الأقرب المتاح: ${res.specialty.name})`}</Text> : null}
            </Text>
          ) : null}
          {!!res.advice && <Text>{res.advice}</Text>}
          {!!res.lab_tests.length && (
            <Row wrap gap={6}>
              <Text variant="small" muted>تحاليل قد يطلبها الطبيب:</Text>
              {res.lab_tests.map((t) => <Badge key={t} label={t} tone="info" />)}
            </Row>
          )}
          {!!res.follow_up_question && <Text variant="small" muted>لنتائج أدق: {res.follow_up_question}</Text>}
          {res.specialty && <Button title={`أقرب أطباء ${res.specialty.name}`} icon={<Stethoscope size={16} color={color.surface} />} onPress={() => onDoctors(res.specialty!.id)} block />}
          {!!res.lab_tests.length && <Button variant="secondary" title="أقرب المختبرات" icon={<FlaskConical size={16} color={color.primary} />} onPress={onLabs} block />}
        </Stack>
      )}
    </Card>
  );
}
