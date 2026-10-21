// ai-triage — «كيف نساعدك اليوم؟»: the signed-in patient describes a complaint
// in their own words; the model suggests WHICH SPECIALTY (from our own list)
// and, when useful, which lab tests a doctor commonly orders, so the app can
// show the nearest doctors / labs. It never diagnoses, never names medicines
// or doses, and sends red-flag complaints to the emergency department.
// The text is sent to Google Gemini and is NOT stored (only a usage count is,
// via ai_triage_begin, for the per-user limit).
// Key: edge secret GEMINI_API_KEY, else Vault secret 'gemini_api_key' (read via the
// service-role-only RPC ai_provider_key). GEMINI_MODEL is optional.
const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
let GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? null;
const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.1-flash-lite';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });

interface Specialty { id: string; code: string; name: string }

// backup to the model: obvious emergencies are flagged even if the model misses them
const RED_FLAGS = [
  /ألم (شديد )?(في|ب)(ال)?صدر/, /ضيق (شديد )?(في|ب)(ال)?(نفس|تنفس)/, /(ما|لا) (اكدر|أقدر|يقدر|استطيع) (اتنفس|أتنفس|يتنفس)/, /اختناق/,
  /فقدان (ال)?وعي/, /غيبوبة/, /اغماء|إغماء/, /شلل|تنميل (نص|نصف|جانب)/, /(ميلان|اعوجاج) (ال)?(فم|وجه)/, /صعوبة (في )?(ال)?كلام/,
  /نزيف (شديد|حاد|ما يوكف|لا يتوقف)/, /(تقيؤ|استفراغ|سعال) (دم|دموي)/, /انتحار|اقتل نفسي|أذي نفسي|أؤذي نفسي/, /تشنج|نوبة صرع/,
  /تورم (ال)?(لسان|حلق|وجه) مع/, /حساسية شديدة/, /تسمم/, /حادث|كسر مفتوح|حروق? (شديد|كبير)/, /نزيف .*حامل|حامل .*نزيف/,
];

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    emergency: { type: 'BOOLEAN' },
    emergency_reason: { type: 'STRING' },
    specialty_code: { type: 'STRING' },
    suggested_specialty: { type: 'STRING' },
    lab_tests: { type: 'ARRAY', items: { type: 'STRING' } },
    advice: { type: 'STRING' },
    follow_up_question: { type: 'STRING' },
  },
  required: ['emergency', 'specialty_code', 'suggested_specialty', 'lab_tests', 'advice'],
};

function prompt(specialties: Specialty[]) {
  return `أنت مساعد توجيه طبي في تطبيق حجز مواعيد في العراق. المستخدم يصف شكواه، ومهمتك فقط أن تقترح أي طبيب (تخصص) يراجع، وأحياناً أي تحاليل مختبرية شائعة قد يطلبها الطبيب.
القواعد:
- لا تشخّص المرض ولا تذكر أسماء أدوية أو جرعات أبداً.
- إذا كانت هناك علامات خطر (ألم صدر، ضيق نفس شديد، علامات جلطة دماغية، فقدان وعي، نزيف شديد، أفكار انتحارية، حساسية شديدة مع تورم، تشنجات، حرارة عالية لرضيع أقل من 3 أشهر، نزيف أثناء الحمل، إصابة شديدة) فاجعل emergency=true واشرح السبب باختصار في emergency_reason.
- specialty_code يجب أن يكون واحداً من الرموز التالية بالضبط، أو "none" إذا لا يناسب أي منها:
${specialties.map((s) => `${s.code} = ${s.name}`).join('\n')}
- إذا لم يتوفر تخصص مناسب في القائمة، ضع specialty_code الأقرب للفحص الأولي (عادةً الباطنية للبالغين أو الأطفال للأطفال) واكتب التخصص الأدق في suggested_specialty.
- suggested_specialty: اسم التخصص المناسب بالعربية.
- lab_tests: من 0 إلى 5 تحاليل شائعة قد تفيد (بأسمائها المتداولة مثل CBC، فيتامين D، السكر التراكمي HbA1c)؛ اتركها فارغة إن لم تكن مفيدة.
- advice: نصيحة عامة قصيرة (جملتان كحد أقصى) بلغة عربية بسيطة، بدون تشخيص وبدون أدوية.
- follow_up_question: سؤال واحد قصير فقط إذا كان الوصف غير كافٍ، وإلا اتركه فارغاً.
- إذا كان النص ليس عن شكوى صحية، ضع specialty_code="none" ووضح في advice أنك تساعد فقط في اختيار الطبيب أو المختبر.`;
}

async function providerKey(): Promise<string | null> {
  if (GEMINI_KEY || !SERVICE) return GEMINI_KEY;
  const r = await fetch(`${URL_}/rest/v1/rpc/ai_provider_key`, {
    method: 'POST', headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' }, body: '{}',
  });
  if (r.ok) GEMINI_KEY = (await r.json()) || null;
  return GEMINI_KEY;
}

async function callGemini(system: string, text: string) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY! },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 600, responseMimeType: 'application/json', responseSchema: SCHEMA },
    }),
  });
  if (!r.ok) throw new Error(`gemini_${r.status}`);
  const body = await r.json();
  const out = body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  return JSON.parse(out) as {
    emergency: boolean; emergency_reason?: string; specialty_code: string; suggested_specialty: string;
    lab_tests: string[]; advice: string; follow_up_question?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const auth = req.headers.get('authorization');
  if (!auth) return json({ error: 'not_authenticated' }, 401);

  let text = '';
  try { text = String((await req.json())?.text ?? '').trim(); } catch { /* empty */ }
  if (text.length < 3 || text.length > 600) return json({ error: 'invalid_input' }, 400);
  if (!(await providerKey())) return json({ error: 'ai_unavailable' }, 503);

  // quota + the specialties list, under the caller's own identity
  const begin = await fetch(`${URL_}/rest/v1/rpc/ai_triage_begin`, {
    method: 'POST', headers: { apikey: ANON, Authorization: auth, 'Content-Type': 'application/json' }, body: '{}',
  });
  if (!begin.ok) {
    const msg = await begin.text();
    const code = /app:(\w+)/.exec(msg)?.[1] ?? (begin.status === 401 ? 'not_authenticated' : 'ai_unavailable');
    return json({ error: code }, code === 'ai_rate_limited' ? 429 : begin.status === 401 ? 401 : 503);
  }
  const { specialties } = (await begin.json()) as { specialties: Specialty[] };

  let ai;
  try {
    ai = await callGemini(prompt(specialties), text);
  } catch (e) {
    console.error('ai-triage', String(e));
    return json({ error: 'ai_unavailable' }, 503);
  }

  const flagged = RED_FLAGS.some((r) => r.test(text));
  const spec = specialties.find((s) => s.code === ai.specialty_code) ?? null;
  return json({
    emergency: !!ai.emergency || flagged,
    emergency_reason: ai.emergency ? (ai.emergency_reason ?? '') : flagged ? 'وصفك يتضمن علامة قد تكون خطيرة.' : '',
    specialty: spec ? { id: spec.id, name: spec.name } : null,
    suggested_specialty: String(ai.suggested_specialty ?? '').slice(0, 80),
    lab_tests: (Array.isArray(ai.lab_tests) ? ai.lab_tests : []).map((t) => String(t).slice(0, 60)).slice(0, 5),
    advice: String(ai.advice ?? '').slice(0, 400),
    follow_up_question: String(ai.follow_up_question ?? '').slice(0, 200),
  });
});
