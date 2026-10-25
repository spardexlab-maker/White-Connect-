import { useState } from 'react';
import { Linking } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { errorMessage } from '@app/shared';
import { supabase, webUrl } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Alert, Button, Field, Row, Stack, Text } from './ui';
import { color } from '../theme';

/** «احذف حسابي» — closes the account for good; the medical record stays with the clinics. */
export function DeleteAccount() {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    if (typed.trim() !== 'حذف') { setError('اكتب كلمة «حذف» للتأكيد.'); return; }
    setBusy(true); setError(null);
    const { error } = await supabase.functions.invoke('delete-account', { body: { confirm: 'DELETE' } });
    if (error) {
      const code = await (error as { context?: Response }).context?.json?.().then((b: { error?: string }) => b.error).catch(() => null);
      setBusy(false);
      setError(errorMessage({ message: `app:${code ?? 'delete_failed'}` }));
      return;
    }
    await signOut();
  };
  return (
    <Stack gap={8}>
      <Text variant="title">حذف الحساب</Text>
      <Text variant="small" muted>يحذف حسابك وطرق دخولك (الرقم والبريد وGoogle) ويوقف التذكيرات والإشعارات.</Text>
      {!open && <Button title="احذف حسابي" variant="danger" small icon={<Trash2 size={16} color={color.surface} />} onPress={() => setOpen(true)} />}
      {open && (
        <>
          <Alert tone="danger" title="ما تكدر ترجع الحساب بعد الحذف">
            حجوزاتك القادمة تُلغى والتذكيرات تتوقف. السجل الطبي يبقى محفوظاً عند الجهات اللي عالجتك كما يفرض القانون، بس ما يرتبط بأي حساب.
          </Alert>
          <Field label="للتأكيد اكتب: حذف" value={typed} onChangeText={(t) => { setTyped(t); setError(null); }} />
          {error && <Alert tone="danger">{error}</Alert>}
          <Row gap={8}>
            <Button title="احذف حسابي نهائياً" variant="danger" loading={busy} onPress={() => void remove()} />
            <Button title="تراجع" variant="ghost" onPress={() => { setOpen(false); setTyped(''); setError(null); }} />
          </Row>
        </>
      )}
      <Button title="شنو يصير ببياناتي؟" variant="ghost" small onPress={() => void Linking.openURL(`${webUrl}/account-deletion`)} />
    </Stack>
  );
}

/** Privacy policy and terms (the web pages; the stores link to the same addresses). */
export function LegalLinks() {
  return (
    <Row gap={4} wrap style={{ justifyContent: 'center' }}>
      <Button title="سياسة الخصوصية" variant="ghost" small onPress={() => void Linking.openURL(`${webUrl}/privacy`)} />
      <Button title="شروط الاستخدام" variant="ghost" small onPress={() => void Linking.openURL(`${webUrl}/terms`)} />
    </Row>
  );
}
