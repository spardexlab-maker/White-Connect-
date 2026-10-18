import { router } from 'expo-router';
import { LogIn, UserRound } from 'lucide-react-native';
import { Button, Card, EmptyState, Screen } from './ui';
import { color } from '../theme';

export function SignInPrompt() {
  return (
    <Screen>
      <Card>
        <EmptyState icon={<UserRound size={28} color={color.mutedText} />} title="سجّل الدخول للمتابعة"
                    action={<Button title="الدخول أو إنشاء حساب" icon={<LogIn size={18} color={color.surface} />} onPress={() => router.navigate('/account')} />}>
          البحث والاطلاع على الأطباء متاح دون حساب. الحجوزات والرحلة الطبية تحتاج حساباً لحماية بياناتك.
        </EmptyState>
      </Card>
    </Screen>
  );
}
