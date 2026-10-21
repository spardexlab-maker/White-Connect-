import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Linking, Modal, Platform, ScrollView, View } from 'react-native';
import { Download, RefreshCw, Sparkles } from 'lucide-react-native';
import * as Updates from 'expo-updates';
import { formatDateTime } from '@app/shared';
import { checkForUpdate, currentVersion, downloadAndInstall, type AvailableUpdate } from '../lib/appUpdate';
import { Alert, Button, Text } from './ui';
import { color, radius, space } from '../theme';

type Status = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'uptodate' | 'error';
interface UpdateState {
  status: Status; update: AvailableUpdate | null; progress: number; error: string | null;
  /** manual = user tapped "check for updates": always opens the result */
  check: (manual?: boolean) => Promise<void>;
  /** an over-the-air update (JS + assets) was downloaded and applies on restart */
  otaReady: boolean;
}
const Ctx = createContext<UpdateState | null>(null);
const RECHECK_MS = 6 * 60 * 60 * 1000;

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('idle');
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const lastCheck = useRef(0);
  const dismissed = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [otaReady, setOtaReady] = useState(false);
  const [otaOpen, setOtaOpen] = useState(false);

  // over-the-air updates (iOS + Android): most changes arrive this way, no reinstall
  const checkOta = useCallback(async (): Promise<boolean> => {
    if (__DEV__ || !Updates.isEnabled) return false;
    const r = await Updates.checkForUpdateAsync();
    if (!r.isAvailable) return false;
    const f = await Updates.fetchUpdateAsync();
    if (!f.isNew) return false;
    setOtaReady(true); setOtaOpen(true);
    return true;
  }, []);

  const check = useCallback(async (manual = false) => {
    lastCheck.current = Date.now();
    setStatus('checking'); setError(null);
    try {
      // a new APK (native changes) first; otherwise a lighter over-the-air update
      const u = Platform.OS === 'android' ? await checkForUpdate() : null;
      setUpdate(u);
      if (u) {
        setStatus('available');
        if (manual || dismissed.current !== u.version) setOpen(true);
        return;
      }
      const ota = await checkOta();
      setStatus(ota ? 'available' : 'uptodate');
    } catch {
      setStatus('error');
      if (manual) setError('تعذّر التحقق من التحديثات. تأكد من الاتصال بالإنترنت وحاول مجدداً.');
    }
  }, [checkOta]);

  // on launch, then whenever the app returns to the foreground (at most every 6 h)
  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active' && Date.now() - lastCheck.current > RECHECK_MS) void check(); });
    return () => sub.remove();
  }, [check]);

  const start = async () => {
    if (!update) return;
    setStatus('downloading'); setProgress(0); setError(null);
    abort.current = new AbortController();
    try {
      await downloadAndInstall(update, setProgress, abort.current.signal);
      setStatus('ready');
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') { setStatus('available'); return; }
      setStatus('available');
      setError('تعذّر تنزيل التحديث داخل التطبيق. يمكنك تنزيله من المتصفح بدلاً من ذلك.');
    }
  };

  const later = () => {
    abort.current?.abort();
    if (update) dismissed.current = update.version;
    setOpen(false);
    if (status === 'downloading') setStatus('available');
  };

  const value = useMemo(() => ({ status, update, progress, error, check, otaReady }), [status, update, progress, error, check, otaReady]);
  const sizeMb = update ? (update.sizeBytes / 1048576).toFixed(0) : '0';

  return (
    <Ctx.Provider value={value}>
      {children}
      <Modal visible={open && !!update} transparent animationType="slide" onRequestClose={later}>
        <View style={{ flex: 1, backgroundColor: 'rgba(14,30,46,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: color.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: space[5], gap: space[3], maxHeight: '80%' }}>
            <View style={{ alignItems: 'center', gap: space[2] }}>
              <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={28} color={color.accent} />
              </View>
              <Text variant="h3" style={{ textAlign: 'center' }}>تحديث جديد متاح</Text>
              <Text variant="small" muted style={{ textAlign: 'center' }}>الإصدار {update?.version} · لديك {currentVersion()} · حجم التنزيل نحو {sizeMb} ميغابايت</Text>
            </View>
            {!!update?.notes && (
              <ScrollView style={{ maxHeight: 180, backgroundColor: color.surfaceSunken, borderRadius: radius.md }} contentContainerStyle={{ padding: space[3] }}>
                <Text variant="small">{update.notes}</Text>
              </ScrollView>
            )}
            {status === 'downloading' && (
              <View style={{ gap: 6 }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
                <View style={{ height: 8, borderRadius: 8, backgroundColor: color.surfaceSunken, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.round(progress * 100)}%`, height: '100%', backgroundColor: color.accent, borderRadius: 8 }} />
                </View>
                <Text variant="small" muted style={{ textAlign: 'center' }}>جارٍ التنزيل… {Math.round(progress * 100)}٪</Text>
              </View>
            )}
            {status === 'ready' && <Alert tone="success" title="اكتمل التنزيل">اتبع شاشة التثبيت من أندرويد. إذا طُلب منك، اسمح بالتثبيت من هذا التطبيق ثم أعد المحاولة.</Alert>}
            {error && (
              <Alert tone="warning" action={update ? <Button title="فتح رابط التنزيل" small variant="secondary" onPress={() => void Linking.openURL(update.url)} /> : undefined}>
                {error}
              </Alert>
            )}
            {status !== 'downloading' && (
              <Button title={status === 'ready' ? 'فتح شاشة التثبيت مجدداً' : 'حدّث الآن'} icon={<Download size={18} color={color.surface} />} onPress={() => void start()} />
            )}
            <Button title={status === 'downloading' ? 'إلغاء التنزيل' : 'لاحقاً'} variant="ghost" onPress={later} />
            <Text variant="small" muted style={{ textAlign: 'center', fontSize: 12 }}>تبقى بياناتك وحسابك كما هي بعد التحديث.</Text>
          </View>
        </View>
      </Modal>
      <Modal visible={otaOpen} transparent animationType="slide" onRequestClose={() => setOtaOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(14,30,46,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: color.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: space[5], gap: space[3] }}>
            <View style={{ alignItems: 'center', gap: space[2] }}>
              <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={28} color={color.accent} />
              </View>
              <Text variant="h3" style={{ textAlign: 'center' }}>تحديث جديد جاهز</Text>
              <Text variant="small" muted style={{ textAlign: 'center' }}>تم تنزيل تحسينات جديدة للتطبيق. تُطبَّق خلال ثوانٍ وتبقى بياناتك كما هي.</Text>
            </View>
            <Button title="تطبيق الآن" icon={<RefreshCw size={18} color={color.surface} />} onPress={() => void Updates.reloadAsync()} />
            <Button title="لاحقاً (يُطبَّق عند فتح التطبيق مرة أخرى)" variant="ghost" onPress={() => setOtaOpen(false)} />
          </View>
        </View>
      </Modal>
    </Ctx.Provider>
  );
}

export function useAppUpdate(): UpdateState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppUpdate outside UpdateProvider');
  return v;
}

/** "Version + check for updates" row for the account screen. */
export function UpdateCheckRow() {
  const { status, check, update, error, otaReady } = useAppUpdate();
  const stamp = !Updates.isEmbeddedLaunch && Updates.createdAt ? ` · تحديث ${formatDateTime(Updates.createdAt.toISOString())}` : '';
  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
        <View style={{ flex: 1 }}>
          <Text variant="title">إصدار التطبيق {currentVersion()}{stamp}</Text>
          <Text variant="small" muted>
            {status === 'checking' ? 'جارٍ التحقق…' : status === 'uptodate' ? 'لديك أحدث نسخة.' : status === 'available' && update ? `يتوفر الإصدار ${update.version}.` : otaReady ? 'تحديث جاهز — يُطبَّق عند إعادة فتح التطبيق.' : 'نسخة تجريبية — التحديثات تصل من هنا.'}
          </Text>
        </View>
        <Button title="التحقق من التحديثات" small variant="secondary" loading={status === 'checking'} icon={<RefreshCw size={16} color={color.primary} />} onPress={() => void check(true)} />
      </View>
      {error && <Alert tone="warning">{error}</Alert>}
    </View>
  );
}
