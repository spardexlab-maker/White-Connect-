import { readAsStringAsync } from 'expo-file-system/legacy';
import { aiErrorMessage, parseSse, type ChatEvent, type ChatMsg } from '@app/shared';
import { supabase } from './supabase';

const FN_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-chat`;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/**
 * Sends the conversation and streams the answer back event by event.
 * React Native's fetch cannot stream, so this uses XMLHttpRequest, whose
 * responseText grows while the server is still writing.
 */
export async function streamChat(messages: ChatMsg[], onEvent: (e: ChatEvent) => void): Promise<void> {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) throw new Error('app:not_authenticated');
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let seen = 0, rest = '';
    const pump = () => {
      const chunk = xhr.responseText.slice(seen);
      seen = xhr.responseText.length;
      const parsed = parseSse(rest + chunk);
      rest = parsed.rest;
      parsed.events.forEach(onEvent);
    };
    xhr.open('POST', FN_URL);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', KEY);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onprogress = () => { if (xhr.status === 200) pump(); };
    xhr.onload = () => {
      if (xhr.status === 200) { pump(); if (rest.trim()) parseSse(`${rest}\n\n`).events.forEach(onEvent); resolve(); return; }
      let code = 'ai_unavailable';
      try { code = JSON.parse(xhr.responseText)?.error ?? code; } catch { /* not json */ }
      reject(new Error(`app:${code}`));
    };
    xhr.onerror = () => reject(new Error('Network request failed'));
    xhr.timeout = 60000;
    xhr.ontimeout = () => reject(new Error('app:ai_unavailable'));
    xhr.send(JSON.stringify({ mode: 'chat', messages }));
  });
}

/** A recorded voice note (m4a) → text. Returns '' when nothing understandable was said. */
export async function transcribe(uri: string): Promise<string> {
  const data = await readAsStringAsync(uri, { encoding: 'base64' });
  const { data: res, error } = await supabase.functions.invoke('ai-chat', { body: { mode: 'transcribe', audio: { mime: 'audio/mp4', data } } });
  if (error) throw new Error(await aiErrorMessage(error));
  return String((res as { text?: string })?.text ?? '').trim();
}
