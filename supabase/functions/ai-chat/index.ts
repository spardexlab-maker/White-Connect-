// ai-chat — the conversational assistant («المساعد الذكي»), Gemini-style:
//  * mode "transcribe": the patient's voice note (m4a / webm) → text
//  * mode "adherence": for the treating doctor — a short summary of how the
//    patient took their medicines (from medication_adherence, read with the
//    doctor's own token, so only a treating doctor gets anything)
//  * mode "chat": the conversation so far → the answer, STREAMED as
//    server-sent events: {"t": "...text..."} chunks, then one final
//    {"done": true, "specialty": {id,name}|null, "labs": [...], "emergency": bool}
// It helps choose WHICH SPECIALTY / LAB to visit (from our own list); it never
// diagnoses, never names medicines or doses, and sends red flags to the ER.
// Nothing the patient says is stored — only a usage count (ai_triage_begin).
// Key: edge secret GEMINI_API_KEY, else Vault 'gemini_api_key' via ai_provider_key.
const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
let GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? null;
const MODELS = [Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];
const AUDIO_TYPES = ['audio/mp4', 'audio/m4a', 'audio/aac', 'audio/webm', 'audio/ogg', 'audio/wav', 'audio/mpeg'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });

interface Specialty { id: string; code: string; name: string }
interface Msg { role: 'user' | 'model'; text: string }

const RED_FLAGS = [
  /ألم (شديد )?(في|ب)(ال)?صدر/, /ضيق (شديد )?(في|ب)(ال)?(نفس|تنفس)/, /(ما|لا) (اكدر|أقدر|يقدر|استطيع) (اتنفس|أتنفس|يتنفس)/, /اختناق/,
  /فقدان (ال)?وعي/, /غيبوبة/, /اغماء|إغماء/, /شلل|تنميل (نص|نصف|جانب)/, /(ميلان|اعوجاج) (ال)?(فم|وجه)/, /صعوبة (في )?(ال)?كلام/,
  /نزيف (شديد|حاد|ما يوكف|لا يتوقف)/, /(تقيؤ|استفراغ|سعال) (دم|دموي)/, /انتحار|اقتل نفسي|أذي نفسي|أؤذي نفسي/, /تشنج|نوبة صرع/,
  /تورم (ال)?(لسان|حلق|وجه) مع/, /حساسية شديدة/, /تسمم/, /حادث|كسر مفتوح|حروق? (شديد|كبير)/, /نزيف .*حامل|حامل .*نزيف/,
];

function system(specialties: Specialty[]) {
  return `أنت «المساعد الذكي» في تطبيق مواعيد طبية في العراق. تتحدث مع المريض بلغة عربية بسيطة وودودة (تفهم اللهجة العراقية)، ومهمتك أن تساعده يعرف أي طبيب (تخصص) أو مختبر يراجع، ثم التطبيق يعرض له الأقرب.
القواعد:
- اكتب بالحروف العربية فقط (ما عدا أسماء التحاليل الشائعة مثل CBC).
- لا تشخّص المرض، ولا تذكر أسماء أدوية أو جرعات أبداً، ولا تطلب صوراً.
- اجعل كل رد قصيراً (من جملتين إلى خمس جمل)، واسأل سؤالاً واحداً للتوضيح إذا كانت المعلومات غير كافية (مثل: منذ متى؟ العمر؟ أعراض أخرى؟).
- عند علامات الخطر (ألم صدر، ضيق نفس شديد، علامات جلطة، فقدان وعي، نزيف شديد، أفكار انتحارية، حساسية شديدة مع تورم، تشنجات، حرارة عالية لرضيع أقل من 3 أشهر، نزيف أثناء الحمل، إصابة شديدة): قل له بوضوح أن يذهب فوراً لأقرب طوارئ أو يتصل بالإسعاف 122، وأضف الوسم [[EMERGENCY]].
- عندما تعرف التخصص المناسب، اذكره بالاسم في كلامك، ثم في سطر أخير منفصل أضف الوسم [[SPECIALTY:الرمز]] حيث الرمز واحد فقط من هذه القائمة:
${specialties.map((s) => `${s.code} = ${s.name}`).join('\n')}
  إذا لم يوجد تخصص مطابق في القائمة، اذكر التخصص الأدق بالكلام واختر في الوسم الأقرب للفحص الأولي (الباطنية للبالغين أو الأطفال للأطفال).
- إذا كانت تحاليل شائعة مفيدة، أضف في السطر الأخير [[LABS:CBC|فيتامين D]] (حتى 5).
- الوسوم تكون في آخر الرد فقط، ولا تشرحها.
- إذا سُئلت عن شيء غير صحي، اعتذر بلطف ووضح أنك تساعد في اختيار الطبيب أو المختبر فقط.`;
}

async function providerKey(): Promise<string | null> {
  if (GEMINI_KEY || !SERVICE) return GEMINI_KEY;
  const r = await fetch(`${URL_}/rest/v1/rpc/ai_provider_key`, {
    method: 'POST', headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' }, body: '{}',
  });
  if (r.ok) GEMINI_KEY = (await r.json()) || null;
  return GEMINI_KEY;
}

/** Calls Gemini, retrying on "busy" (429/503) and falling back to the second model. */
async function gemini(method: 'generateContent' | 'streamGenerateContent', body: unknown): Promise<Response> {
  let last = 0;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt && last === 0) break;
      let r: Response;
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}${method === 'streamGenerateContent' ? '?alt=sse' : ''}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY! },
          signal: AbortSignal.timeout(20000), body: JSON.stringify(body),
        });
      } catch { last = 0; continue; }   // timeout: try the next model
      if (r.ok) return r;
      last = r.status;
      await r.body?.cancel();
      if (r.status !== 429 && r.status !== 503 && r.status !== 500) throw new Error(`gemini_${r.status}`);
      await new Promise((ok) => setTimeout(ok, 700 * (attempt + 1)));
    }
  }
  throw new Error(`gemini_${last}`);
}

function parseTags(full: string, specialties: Specialty[]) {
  const code = /\[\[SPECIALTY:([^\]]+)\]\]/.exec(full)?.[1]?.trim();
  const labs = (/\[\[LABS:([^\]]+)\]\]/.exec(full)?.[1] ?? '').split('|').map((s) => s.trim().slice(0, 60)).filter(Boolean).slice(0, 5);
  const spec = specialties.find((s) => s.code === code) ?? null;
  return { specialty: spec ? { id: spec.id, name: spec.name } : null, labs, emergency: /\[\[EMERGENCY\]\]/.test(full) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const auth = req.headers.get('authorization');
  if (!auth) return json({ error: 'not_authenticated' }, 401);

  let body: { mode?: string; messages?: Msg[]; audio?: { mime?: string; data?: string }; patient_id?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const mode = body.mode === 'transcribe' ? 'transcribe' : body.mode === 'adherence' ? 'adherence' : 'chat';
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m?.role === 'user' || m?.role === 'model') && typeof m.text === 'string' && m.text.trim())
    .slice(-20).map((m) => ({ role: m.role, text: m.text.trim().slice(0, 1500) }));
  if (mode === 'transcribe') {
    const mime = String(body.audio?.mime ?? '').split(';')[0];
    if (!AUDIO_TYPES.includes(mime) || !body.audio?.data || body.audio.data.length > 3_000_000) return json({ error: 'invalid_input' }, 400);
  } else if (mode === 'adherence') {
    if (!/^[0-9a-f-]{36}$/i.test(String(body.patient_id ?? ''))) return json({ error: 'invalid_input' }, 400);
  } else if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return json({ error: 'invalid_input' }, 400);
  }
  if (!(await providerKey())) return json({ error: 'ai_unavailable' }, 503);

  // usage limit + the specialties list, under the caller's own identity
  const begin = await fetch(`${URL_}/rest/v1/rpc/ai_triage_begin`, {
    method: 'POST', headers: { apikey: ANON, Authorization: auth, 'Content-Type': 'application/json' }, body: '{}',
  });
  if (!begin.ok) {
    const code = /app:(\w+)/.exec(await begin.text())?.[1] ?? (begin.status === 401 ? 'not_authenticated' : 'ai_unavailable');
    return json({ error: code }, code === 'ai_rate_limited' ? 429 : begin.status === 401 ? 401 : 503);
  }
  const { specialties } = (await begin.json()) as { specialties: Specialty[] };

  if (mode === 'adherence') {
    const a = await fetch(`${URL_}/rest/v1/rpc/medication_adherence`, {
      method: 'POST', headers: { apikey: ANON, Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_patient_id: body.patient_id, p_days: 14 }),
    });
    if (!a.ok) return json({ error: /app:(\w+)/.exec(await a.text())?.[1] ?? 'forbidden' }, 403);
    const plans = (await a.json()) as Record<string, unknown>[];
    if (!plans.length) return json({ text: 'لا توجد أدوية مسجلة بتذكيرات لهذا المريض خلال آخر 14 يوماً.' });
    // only what the summary needs — no names or identifiers of the patient
    const facts = plans.map((p) => ({
      medicine: p.display_name, prescribed: p.prescribed, status: p.status, dose: p.dose, unit: p.dose_unit, every_hours: p.interval_hours,
      due: p.due, taken: p.taken, skipped: p.skipped, missed: p.missed, taken_amount: p.taken_amount, last_taken_at: p.last_taken_at,
      recent: (p.recent as { at: string; state: string }[] | undefined)?.map((d) => `${d.at.slice(5, 16).replace('T', ' ')} ${d.state}`),
    }));
    try {
      const r = await gemini('generateContent', {
        systemInstruction: { parts: [{ text: `أنت تساعد طبيباً في عيادة بالعراق. لخّص له التزام مريضه بالأدوية خلال آخر 14 يوماً من البيانات المرفقة (taken = أخذها، skipped = تخطاها، missed = لم يسجّل، الأوقات بتوقيت UTC وأضف 3 ساعات لتوقيت بغداد).
اكتب بالعربية الفصحى المبسطة وبالحروف العربية فقط، بنقاط قصيرة (3 إلى 5 نقاط):
- الحكم العام: ملتزم / متذبذب / غير ملتزم مع النسبة.
- الأدوية التي تُفوَّت أكثر، وهل هناك نمط (مثلاً جرعات الليل أو نهاية الأسبوع).
- اقتراح عملي للطبيب لمناقشته مع المريض (مثل سبب التفويت أو تبسيط المواعيد).
لا تشخّص، ولا تقترح تغيير دواء أو جرعة، ولا تخترع بيانات غير موجودة.` }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(facts) }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
      });
      const out = (await r.json())?.candidates?.[0]?.content?.parts?.map((x: { text?: string }) => x.text ?? '').join('').trim() ?? '';
      return json({ text: out.replace(/[\u0590-\u05FF\u0400-\u04FF\u4E00-\u9FFF]/g, '').slice(0, 2000) });
    } catch (e) {
      console.error('ai-chat adherence', String(e));
      return json({ error: 'ai_unavailable' }, 503);
    }
  }

  if (mode === 'transcribe') {
    try {
      const r = await gemini('generateContent', {
        contents: [{ role: 'user', parts: [
          { inline_data: { mime_type: String(body.audio!.mime).split(';')[0], data: body.audio!.data } },
          { text: 'اكتب نص هذا الكلام حرفياً كما قيل (عربي أو لهجة عراقية)، بدون أي إضافة أو شرح.' },
        ] }],
        generationConfig: { temperature: 0, maxOutputTokens: 400 },
      });
      const out = (await r.json())?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('').trim() ?? '';
      return json({ text: out.slice(0, 1500) });
    } catch (e) {
      console.error('ai-chat transcribe', String(e));
      return json({ error: 'ai_unavailable' }, 503);
    }
  }

  let upstream: Response;
  try {
    upstream = await gemini('streamGenerateContent', {
      systemInstruction: { parts: [{ text: system(specialties) }] },
      contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      generationConfig: { temperature: 0.3, maxOutputTokens: 700 },
    });
  } catch (e) {
    console.error('ai-chat', String(e));
    return json({ error: 'ai_unavailable' }, 503);
  }

  const flagged = RED_FLAGS.some((r) => r.test(messages[messages.length - 1].text));
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
      if (flagged) send({ meta: { emergency: true } });
      let full = '', buf = '';
      const reader = upstream.body!.pipeThrough(new TextDecoderStream()).getReader();
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value.replace(/\r\n/g, '\n');
          let i;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const event = buf.slice(0, i); buf = buf.slice(i + 2);
            const line = event.split('\n').find((l) => l.startsWith('data:'));
            if (!line) continue;
            try {
              const t = JSON.parse(line.slice(5))?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
              // the model very rarely slips a letter from another script into an Arabic word
              const clean = t.replace(/[\u0590-\u05FF\u0400-\u04FF\u4E00-\u9FFF]/g, '');
              if (clean) { full += clean; send({ t: clean }); }
            } catch { /* partial / keep-alive */ }
          }
        }
        const tags = parseTags(full, specialties);
        send({ done: true, ...tags, emergency: tags.emergency || flagged });
      } catch (e) {
        console.error('ai-chat stream', String(e));
        send({ error: 'ai_unavailable' });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { ...CORS, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' } });
});
