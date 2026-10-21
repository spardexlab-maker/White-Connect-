import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Mic, Send, Sparkles } from 'lucide-react-native';
import { Card, Row, Stack, Text } from './ui';
import { color, family, radius, size, space, startAlign } from '../theme';

/** «المساعد الذكي» on the home screen: type or tap the mic — the conversation opens on its own screen. */
export function AiAssist() {
  const [text, setText] = useState('');
  const go = () => { const q = text.trim(); setText(''); router.push(q ? { pathname: '/assistant', params: { q } } : '/assistant'); };
  return (
    <Card>
      <Row gap={space[2]}>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={18} color="#fff" />
        </View>
        <Stack gap={0} style={{ flex: 1 }}>
          <Text variant="title">المساعد الذكي</Text>
          <Text variant="small" muted>احجي أو اكتب شنو تعاني، ونقترحلك أي طبيب أو مختبر تراجع — والأقرب إليك.</Text>
        </Stack>
      </Row>
      <Row gap={space[2]} style={{ alignItems: 'center' }}>
        <Pressable onPress={() => router.push({ pathname: '/assistant', params: { voice: '1' } })} accessibilityRole="button" accessibilityLabel="احجي ويا المساعد"
                   style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Mic size={22} color="#fff" />
        </Pressable>
        <TextInput value={text} onChangeText={setText} onSubmitEditing={go} returnKeyType="send" placeholder="مثال: عندي صداع من أسبوع"
                   placeholderTextColor={color.mutedText} accessibilityLabel="اكتب للمساعد"
                   style={{ flex: 1, minWidth: 0, width: 0, minHeight: 50, borderWidth: 1, borderColor: color.border, borderRadius: radius.lg, paddingHorizontal: space[3],
                            fontFamily: family.regular, fontSize: size.body, color: color.text, textAlign: startAlign }} />
        <Pressable onPress={go} accessibilityRole="button" accessibilityLabel="ابدأ المحادثة"
                   style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Send size={20} color="#fff" style={{ transform: [{ scaleX: -1 }] }} />
        </Pressable>
      </Row>
    </Card>
  );
}
