import { aiErrorMessage, parseSse, type ChatEvent, type ChatMsg } from '@app/shared';
import { supabase } from './supabase';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

/** Sends the conversation and streams the answer back event by event. */
export async function streamChat(messages: ChatMsg[], onEvent: (e: ChatEvent) => void): Promise<void> {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) throw new Error('app:not_authenticated');
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'chat', messages }),
  });
  if (!res.ok || !res.body) {
    let code = 'ai_unavailable';
    try { code = (await res.json())?.error ?? code; } catch { /* not json */ }
    throw new Error(`app:${code}`);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let rest = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const parsed = parseSse(rest + value);
    rest = parsed.rest;
    parsed.events.forEach(onEvent);
  }
  if (rest.trim()) parseSse(`${rest}\n\n`).events.forEach(onEvent);
}

/** Records from the microphone until stop() is called; resolves the recording. */
export async function startRecording(): Promise<{ stop: () => Promise<Blob>; cancel: () => void }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.start();
  const release = () => stream.getTracks().forEach((t) => t.stop());
  return {
    stop: () => new Promise<Blob>((resolve) => {
      rec.onstop = () => { release(); resolve(new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' })); };
      rec.stop();
    }),
    cancel: () => { rec.onstop = release; if (rec.state !== 'inactive') rec.stop(); else release(); },
  };
}

/** A voice note → text ('' when nothing understandable was said). */
export async function transcribe(blob: Blob): Promise<string> {
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
  const { data: res, error } = await supabase.functions.invoke('ai-chat', { body: { mode: 'transcribe', audio: { mime: blob.type.split(';')[0], data } } });
  if (error) throw new Error(await aiErrorMessage(error));
  return String((res as { text?: string })?.text ?? '').trim();
}
