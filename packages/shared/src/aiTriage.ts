import { errorMessage } from './errors';

/** Answer of the `ai-triage` edge function (a suggestion for where to go — not a diagnosis). */
export interface AiTriage {
  emergency: boolean;
  emergency_reason: string;
  specialty: { id: string; name: string } | null;
  suggested_specialty: string;
  lab_tests: string[];
  advice: string;
  follow_up_question: string;
}

export const aiTriageDisclaimer =
  'اقتراح للتوجيه فقط وليس تشخيصاً ولا يغني عن الطبيب. يُرسل ما تكتبه إلى خدمة ذكاء اصطناعي (Google Gemini) ولا يُحفظ لدينا — لا تكتب اسمك أو أرقامك.';

/** Arabic message for a failed functions.invoke('ai-triage') call (its body is `{ error: code }`). */
export async function aiErrorMessage(err: unknown): Promise<string> {
  const ctx = (err as { context?: Response })?.context;
  let code = 'ai_unavailable';
  try { if (ctx && typeof ctx.json === 'function') code = (await ctx.json())?.error ?? code; } catch { /* not json */ }
  if (code === 'invalid_input') return 'اكتب وصفاً أوضح (من 3 إلى 600 حرف).';
  return errorMessage({ message: `app:${code}` });
}
