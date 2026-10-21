/** Conversation with the assistant (edge function `ai-chat`). */
export interface ChatMsg { role: 'user' | 'model'; text: string }

/** What the assistant suggested at the end of an answer. */
export interface ChatSuggestion {
  specialty: { id: string; name: string } | null;
  labs: string[];
  emergency: boolean;
}

export type ChatEvent = { t: string } | { meta: { emergency: boolean } } | ({ done: true } & ChatSuggestion) | { error: string };

/** Splits a growing server-sent-events buffer into parsed events plus the unfinished rest. */
export function parseSse(buffer: string): { events: ChatEvent[]; rest: string } {
  const parts = buffer.replace(/\r\n/g, '\n').split('\n\n');
  const rest = parts.pop() ?? '';
  const events: ChatEvent[] = [];
  for (const p of parts) {
    const line = p.split('\n').find((l) => l.startsWith('data:'));
    if (!line) continue;
    try { events.push(JSON.parse(line.slice(5)) as ChatEvent); } catch { /* ignore a malformed event */ }
  }
  return { events, rest };
}

/** The text to show: without the machine tags ([[SPECIALTY:…]] etc.), even half-streamed ones. */
export function visibleAnswer(text: string): string {
  return text.replace(/\[\[[^\]]*\]\]/g, '').replace(/\[\[[^\]]*$/, '').replace(/\[$/, '').trim();
}

export const aiChatStarters = ['عندي صداع من كم يوم', 'ابني عنده حرارة وكحة', 'أريد أسوي فحوصات عامة', 'ألم بالمعدة بعد الأكل'];

export const aiChatDisclaimer = 'المساعد يقترح عليك أي طبيب أو مختبر تراجع، وليس تشخيصاً ولا يغني عن الطبيب. في الحالات الطارئة اتصل بـ 122.';
