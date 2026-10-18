import { useEffect } from 'react';
import { I18nManager, Platform, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts, IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium, IBMPlexSansArabic_600SemiBold, IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { AuthProvider } from '../src/lib/auth';
import { configMissing } from '../src/lib/supabase';
import { Alert, Screen } from '../src/components/ui';
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

export default function RootLayout() {
  const [loaded] = useFonts({ IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium, IBMPlexSansArabic_600SemiBold, IBMPlexSansArabic_700Bold });

  useEffect(() => { if (loaded) void SplashScreen.hideAsync().catch(() => undefined); }, [loaded]);

  // Tapping a reminder opens the medication plan.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const url = r.notification.request.content.data?.url;
      if (url === '/meds') router.push('/meds');
    });
    return () => sub.remove();
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
          <Stack.Screen name="card/[patientId]" options={{ title: 'بطاقة التعريف', presentation: 'modal' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
