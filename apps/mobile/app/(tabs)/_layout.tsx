import { Pressable } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Activity, Bell, CalendarDays, House, Route, UserRound } from 'lucide-react-native';
import { color, family } from '../../src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: color.primary },
        headerTintColor: color.surface,
        headerTitleStyle: { fontFamily: family.semibold },
        tabBarActiveTintColor: color.accent,
        tabBarInactiveTintColor: color.mutedText,
        tabBarLabelStyle: { fontFamily: family.medium, fontSize: 12 },
        tabBarStyle: { borderTopColor: color.border, minHeight: 60 },
        // notifications live behind the bell so «صحتي» fits in the tab bar
        headerRight: () => (
          <Pressable accessibilityRole="button" accessibilityLabel="الإشعارات" hitSlop={10} style={{ paddingHorizontal: 16 }} onPress={() => router.push('/notifications')}>
            <Bell size={22} color={color.surface} />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'الرئيسية', headerTitle: 'منصة الرعاية', tabBarIcon: ({ color: c, size }) => <House color={c} size={size} /> }} />
      <Tabs.Screen name="appointments" options={{ title: 'حجوزاتي', tabBarIcon: ({ color: c, size }) => <CalendarDays color={c} size={size} /> }} />
      <Tabs.Screen name="health" options={{ title: 'صحتي', headerTitle: 'صحتي', tabBarIcon: ({ color: c, size }) => <Activity color={c} size={size} /> }} />
      <Tabs.Screen name="journey" options={{ title: 'رحلتي', headerTitle: 'رحلتي الطبية', tabBarIcon: ({ color: c, size }) => <Route color={c} size={size} /> }} />
      <Tabs.Screen name="notifications" options={{ title: 'الإشعارات', href: null }} />
      <Tabs.Screen name="account" options={{ title: 'حسابي', tabBarIcon: ({ color: c, size }) => <UserRound color={c} size={size} /> }} />
    </Tabs>
  );
}
