import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, TextInput, View, type ScrollViewInstance } from 'react-native';
import { Stack as RouterStack, router, useLocalSearchParams } from 'expo-router';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as Speech from 'expo-speech';
import { FlaskConical, Mic, PhoneCall, Send, Sparkles, Square, Stethoscope, Volume2, VolumeX } from 'lucide-react-native';
import { aiChatDisclaimer, aiChatStarters, errorMessage, visibleAnswer, type ChatSuggestion } from '@app/shared';
import { streamChat, transcribe } from '../src/lib/aiChat';
import { useAuth } from '../src/lib/auth';
import { AuthForm } from '../src/components/AuthForms';
import { Alert, Badge, Button, Card, Chip, Row, Screen, Text } from '../src/components/ui';
import { color, family, radius, size, space, startAlign } from '../src/theme';

interface Bubble { id: number; role: 'user' | 'model'; text: string; streaming?: boolean; error?: string; suggestion?: ChatSuggestion; emergency?: boolean }

const MAX_RECORDING_MS = 60_000;
const message = (e: unknown) => {
  const m = String((e as Error)?.message ?? '');
  return m.startsWith('app:') || /network|fetch/i.test(m) ? errorMessage(e) : m || errorMessage(e);
};

/** «المساعد الذكي» — a conversation like Gemini: speak or type, the answer streams in as it is written. */
export default function AssistantScreen() {
  const { session } = useAuth();
  const params = useLocalSearchParams<{ q?: string; voice?: string }>();
  const [msgs, setMsgs] = useState<Bubble[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const nextId = useRef(1);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const rec = useAudioRecorderState(recorder, 250);

  const msgsRef = useRef<Bubble[]>([]);
  useEffect(() => { msgsRef.current = msgs; }, [msgs]);
  const patch = (id: number, f: (b: Bubble) => Bubble) => setMsgs((all) => all.map((b) => (b.id === id ? f(b) : b)));

  const send = useCallback(async (raw: string) => {
    const said = raw.trim();
    if (!said || busy) return;
    setNotice(null); setText(''); setBusy(true);
    const user: Bubble = { id: nextId.current++, role: 'user', text: said };
    const answer: Bubble = { id: nextId.current++, role: 'model', text: '', streaming: true };
    // built from the ref, not inside the state updater: React may run that updater later
    const history = [...msgsRef.current, user].filter((b) => !b.error && b.text)
      .map((b) => ({ role: b.role, text: b.role === 'model' ? visibleAnswer(b.text) : b.text }));
    setMsgs((all) => [...all, user, answer]);
    try {
      await streamChat(history, (e) => {
        if ('t' in e) patch(answer.id, (b) => ({ ...b, text: b.text + e.t }));
        else if ('meta' in e) patch(answer.id, (b) => ({ ...b, emergency: b.emergency || e.meta.emergency }));
        else if ('done' in e) patch(answer.id, (b) => ({ ...b, streaming: false, suggestion: { specialty: e.specialty, labs: e.labs, emergency: e.emergency } }));
        else if ('error' in e) patch(answer.id, (b) => ({ ...b, streaming: false, error: errorMessage({ message: `app:${e.error}` }) }));
      });
      patch(answer.id, (b) => ({ ...b, streaming: false }));
    } catch (e) {
      patch(answer.id, (b) => ({ ...b, streaming: false, error: message(e) }));
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const startRecording = async () => {
    setNotice(null);
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) { setNotice('اسمح للتطبيق باستخدام المايكروفون من الإعدادات حتى تحجي ويا المساعد.'); return; }
    Speech.stop(); setSpeaking(null);
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setPhase('recording');
  };

  const stopRecording = useCallback(async () => {
    if (phase !== 'recording') return;
    setPhase('transcribing');
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      const said = uri ? await transcribe(uri) : '';
      if (!said) { setNotice('ما سمعت كلام واضح — حاول مرة ثانية واحجي قريب من الموبايل.'); return; }
      await send(said);
    } catch (e) {
      setNotice(message(e));
    } finally {
      setPhase('idle');
    }
  }, [phase, recorder, send]);

  // stop automatically after a minute
  useEffect(() => { if (phase === 'recording' && rec.durationMillis >= MAX_RECORDING_MS) void stopRecording(); }, [phase, rec.durationMillis, stopRecording]);
  // opened from the home screen with a first message or straight into voice
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !session) return;
    started.current = true;
    if (params.q) void send(String(params.q));
    else if (params.voice === '1') void startRecording();
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { Speech.stop(); }, []);

  const speak = (b: Bubble) => {
    if (speaking === b.id) { Speech.stop(); setSpeaking(null); return; }
    Speech.stop();
    setSpeaking(b.id);
    Speech.speak(visibleAnswer(b.text), { language: 'ar', onDone: () => setSpeaking(null), onStopped: () => setSpeaking(null), onError: () => setSpeaking(null) });
  };

  if (!session) {
    return (
      <Screen>
        <RouterStack.Screen options={{ title: 'المساعد الذكي' }} />
        <Card><Text variant="title">سجّل الدخول حتى تحجي ويا المساعد</Text><AuthForm /></Card>
      </Screen>
    );
  }

  const seconds = Math.floor(rec.durationMillis / 1000);
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <RouterStack.Screen options={{ title: 'المساعد الذكي' }} />
      <ScrollView ref={scroll} contentContainerStyle={{ padding: space[4], gap: space[3], paddingBottom: space[6] }}
                  onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} keyboardShouldPersistTaps="handled">
        <Text variant="small" muted style={{ textAlign: 'center' }}>{aiChatDisclaimer}</Text>
        {msgs.length === 0 && (
          <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[6] }}>
            <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={30} color="#fff" />
            </View>
            <Text variant="h3" style={{ textAlign: 'center' }}>شنو تحس؟ احجيلي</Text>
            <Text variant="small" muted style={{ textAlign: 'center' }}>دوس على المايك واحجي، أو اكتب. أساعدك تعرف أي طبيب أو مختبر تراجع، وأعرضلك الأقرب.</Text>
            <Row wrap gap={space[2]} style={{ justifyContent: 'center' }}>
              {aiChatStarters.map((s) => <Chip key={s} label={s} onPress={() => void send(s)} />)}
            </Row>
          </View>
        )}
        {msgs.map((b) => (b.role === 'user' ? (
          <View key={b.id} style={{ alignSelf: 'flex-start', maxWidth: '85%', backgroundColor: color.primary, borderRadius: 18, borderTopStartRadius: 6, paddingHorizontal: space[4], paddingVertical: space[3] }}>
            <Text style={{ color: '#fff' }}>{b.text}</Text>
          </View>
        ) : (
          <View key={b.id} style={{ alignSelf: 'flex-end', width: '92%', gap: space[2] }}>
            <View style={{ backgroundColor: color.surface, borderRadius: 18, borderTopEndRadius: 6, padding: space[4], gap: space[2], borderWidth: 1, borderColor: color.border }}>
              {b.emergency && (
                <Alert tone="danger" title="توجّه فوراً لأقرب طوارئ"
                       action={<Button small variant="danger" title="اتصل 122" icon={<PhoneCall size={14} color={color.surface} />} onPress={() => void Linking.openURL('tel:122')} />}>
                  لا تنتظر موعداً — اتصل بالإسعاف أو اذهب لأقرب مستشفى.
                </Alert>
              )}
              {b.text ? <Text>{visibleAnswer(b.text)}{b.streaming ? ' ▍' : ''}</Text> : b.streaming ? <Row gap={8}><ActivityIndicator color={color.accent} /><Text variant="small" muted>يكتب…</Text></Row> : null}
              {b.error && <Alert tone="warning">{b.error}</Alert>}
              {!b.streaming && !!b.text && (
                <Pressable onPress={() => speak(b)} accessibilityRole="button" accessibilityLabel={speaking === b.id ? 'إيقاف القراءة' : 'اقرأ الجواب بصوت'}
                           style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 }}>
                  {speaking === b.id ? <VolumeX size={16} color={color.accent} /> : <Volume2 size={16} color={color.accent} />}
                  <Text variant="small" style={{ color: color.accent }}>{speaking === b.id ? 'إيقاف' : 'استمع'}</Text>
                </Pressable>
              )}
            </View>
            {!b.streaming && b.suggestion && (b.suggestion.specialty || b.suggestion.labs.length > 0) && (
              <View style={{ gap: space[2] }}>
                {b.suggestion.labs.length > 0 && (
                  <Row wrap gap={6}><Text variant="small" muted>تحاليل قد يطلبها الطبيب:</Text>{b.suggestion.labs.map((t) => <Badge key={t} label={t} tone="info" />)}</Row>
                )}
                {b.suggestion.specialty && (
                  <Button title={`أقرب أطباء ${b.suggestion.specialty.name}`} icon={<Stethoscope size={16} color={color.surface} />} block
                          onPress={() => router.navigate({ pathname: '/', params: { kind: 'doctor', specialty: b.suggestion!.specialty!.id } })} />
                )}
                {b.suggestion.labs.length > 0 && (
                  <Button title="أقرب المختبرات" variant="secondary" icon={<FlaskConical size={16} color={color.primary} />} block
                          onPress={() => router.navigate({ pathname: '/', params: { kind: 'laboratory' } })} />
                )}
              </View>
            )}
          </View>
        )))}
        {notice && <Alert tone="warning">{notice}</Alert>}
      </ScrollView>

      <View style={{ borderTopWidth: 1, borderColor: color.border, backgroundColor: color.surface, padding: space[3], gap: space[2] }}>
        {phase === 'recording' ? (
          <Row gap={space[3]} style={{ alignItems: 'center' }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color.danger }} />
            <Text style={{ flex: 1 }}>يسجّل… {seconds} ث — احجي وبعدين دوس إيقاف</Text>
            <Pressable onPress={() => void stopRecording()} accessibilityRole="button" accessibilityLabel="إيقاف التسجيل والإرسال"
                       style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: color.danger, alignItems: 'center', justifyContent: 'center' }}>
              <Square size={20} color="#fff" fill="#fff" />
            </Pressable>
          </Row>
        ) : phase === 'transcribing' ? (
          <Row gap={space[2]} style={{ alignItems: 'center', justifyContent: 'center', minHeight: 52 }}>
            <ActivityIndicator color={color.accent} /><Text muted>جاري فهم كلامك…</Text>
          </Row>
        ) : (
          <Row gap={space[2]} style={{ alignItems: 'flex-end' }}>
            <Pressable onPress={() => void startRecording()} disabled={busy} accessibilityRole="button" accessibilityLabel="احجي ويا المساعد"
                       style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: busy ? color.border : color.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Mic size={24} color="#fff" />
            </Pressable>
            <TextInput value={text} onChangeText={setText} placeholder="اكتب شنو تحس…" placeholderTextColor={color.mutedText} multiline maxLength={1000}
                       accessibilityLabel="رسالتك للمساعد"
                       style={{ flex: 1, minWidth: 0, width: 0, minHeight: 52, maxHeight: 120, borderWidth: 1, borderColor: color.border, borderRadius: radius.lg, paddingHorizontal: space[3],
                                paddingVertical: 12, fontFamily: family.regular, fontSize: size.body, color: color.text, textAlign: startAlign }} />
            <Pressable onPress={() => void send(text)} disabled={busy || !text.trim()} accessibilityRole="button" accessibilityLabel="إرسال"
                       style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: busy || !text.trim() ? color.border : color.primary, alignItems: 'center', justifyContent: 'center' }}>
              {busy ? <ActivityIndicator color="#fff" /> : <Send size={22} color="#fff" style={{ transform: [{ scaleX: -1 }] }} />}
            </Pressable>
          </Row>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
