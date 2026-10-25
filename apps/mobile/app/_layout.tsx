import { useEffect } from 'react';
import { AppState, I18nManager, Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts, IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium, IBMPlexSansArabic_600SemiBold, IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { AuthProvider } from '../src/lib/auth';
import { UpdateProvider } from '../src/components/UpdatePrompt';
import { handleDoseResponse, resyncDoses } from '../src/lib/doseActions';
import { watchPushToken } from '../src/lib/push';
import { configMissing } from '../src/lib/supabase';
import { installErrorReporting, reportError } from '../src/lib/errorReport';
import { Alert, Button, Screen, Text } from '../src/components/ui';
import { color, family } from '../src/theme';

// Arabic-first: the whole app is right-to-left.
if (Platform.OS !== 'web' && !I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.documentElement.dir = 'rtl';
  document.documentElement.lang = 'ar';
}
void SplashScreen.preventAutoHideAsync().catch(() => undefined);
installErrorReporting();

/** A screen that crashed shows a way out (and is reported) instead of a red or blank screen. */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  useEffect(() => { reportError(error, 'screen'); }, [error]);
  return (
    <Screen>
      <Alert tone="danger" title="صار خلل بهاي الشاشة">وصلنا تنبيه بالمشكلة وراح نصلحها.</Alert>
      <Text variant="small" muted>جرّب مرة ثانية، وإذا تكرر سكّر التطبيق وافتحه.</Text>
      <Button title="حاول مرة ثانية" onPress={() => void retry()} />
    </Screen>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({ IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium, IBMPlexSansArabic_600SemiBold, IBMPlexSansArabic_700Bold });

  useEffect(() => { if (loaded) void SplashScreen.hideAsync().catch(() => undefined); }, [loaded]);

  // Medication reminders: «أخذتها ✓» / «ذكرني بعد 15 د» on the notification log the dose;
  // a plain tap opens the plan. Doses are re-synced from the server whenever the app opens.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => void handleDoseResponse(r));
    void Notifications.getLastNotificationResponseAsync().then((r) => { if (r) void handleDoseResponse(r); });
    void resyncDoses();
    const app = AppState.addEventListener('change', (st) => { if (st === 'active') void resyncDoses(); });
    const unwatch = watchPushToken();
    return () => { sub.remove(); app.remove(); unwatch(); };
  }, []);

  if (!loaded) return <View style={{ flex: 1, backgroundColor: color.primary }} />;

  if (configMissing) {
    return (
      <Screen>
        <Alert tone="danger" title="إعدادات الاتصال ناقصة">ضع EXPO_PUBLIC_SUPABASE_URL و EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY في ملف ‎.env ثم أعد التشغيل.</Alert>
      </Screen>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <UpdateProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: color.primary },
            headerTintColor: color.surface,
            headerTitleStyle: { fontFamily: family.semibold },
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: color.canvas },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="provider/[facilityId]" options={{ title: 'مقدم الخدمة' }} />
          <Stack.Screen name="book/[facilityId]" options={{ title: 'حجز موعد' }} />
          <Stack.Screen name="rx/[id]" options={{ title: 'الوصفة' }} />
          <Stack.Screen name="lab/[orderId]" options={{ title: 'نتائج التحليل' }} />
          <Stack.Screen name="meds" options={{ title: 'خطة الدواء' }} />
          <Stack.Screen name="home-lab" options={{ title: 'تحليل منزلي' }} />
          <Stack.Screen name="lab-orders" options={{ title: 'طلبات التحاليل' }} />
          <Stack.Screen name="card/[patientId]" options={{ title: 'بطاقة التعريف', presentation: 'modal' }} />
        </Stack>
        </UpdateProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
