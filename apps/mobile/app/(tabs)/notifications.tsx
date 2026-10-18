import { useCallback } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Bell, CheckCheck } from 'lucide-react-native';
import { formatDateTime } from '@app/shared';
import { supabase } from '../../src/lib/supabase';
import { unwrap, useAsync } from '../../src/lib/useAsync';
import { useAuth } from '../../src/lib/auth';
import { SignInPrompt } from '../../src/components/SignInPrompt';
import { Button, Card, EmptyState, ErrorState, Loading, Row, Screen, Text } from '../../src/components/ui';
import { color, space } from '../../src/theme';

interface N { id: string; title: string; body: string; read_at: string | null; created_at: string }

export default function Notifications() {
  const { session } = useAuth();
  const list = useAsync(async () => (session
    ? ((await unwrap(supabase.from('notifications').select('id, title, body, read_at, created_at').order('created_at', { ascending: false }).limit(50))) as N[])
    : []), [session?.user.id]);
  useFocusEffect(useCallback(() => { if (session) list.reload(); }, [session?.user.id])); // eslint-disable-line react-hooks/exhaustive-deps
  if (!session) return <SignInPrompt />;

  const unread = (list.data ?? []).filter((n) => !n.read_at);
  const markAll = async () => {
    if (!unread.length) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unread.map((n) => n.id));
    list.reload();
  };

  return (
    <Screen refreshing={list.status === 'loading' && !!list.data} onRefresh={list.reload}>
      {unread.length > 0 && <Button title="تعليم الكل كمقروء" variant="secondary" small icon={<CheckCheck size={16} color={color.primary} />} onPress={markAll} />}
      {list.status === 'loading' && !list.data && <Card><Loading /></Card>}
      {list.status === 'error' && <Card><ErrorState error={list.error} onRetry={list.reload} /></Card>}
      {list.data?.length === 0 && (
        <Card><EmptyState icon={<Bell size={28} color={color.mutedText} />} title="لا توجد إشعارات">ستصلك هنا تحديثات حالة الحجوزات والوصفات والنتائج.</EmptyState></Card>
      )}
      {list.data?.map((n) => (
        <Card key={n.id} style={[{ padding: space[3] }, !n.read_at && { backgroundColor: color.accentSoft, borderColor: color.accentSoft }]}>
          <Row gap={space[3]} style={{ alignItems: 'flex-start' }}>
            <Bell size={18} color={color.accent} />
            <View style={{ flex: 1, gap: 2 }} accessible accessibilityLabel={`${n.read_at ? '' : 'غير مقروء: '}${n.title}. ${n.body}`}>
              <Text variant="title" style={{ fontSize: 15 }}>{n.title}</Text>
              <Text variant="small">{n.body}</Text>
              <Text variant="small" muted>{formatDateTime(n.created_at)}</Text>
            </View>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
