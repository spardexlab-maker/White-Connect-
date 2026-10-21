import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

/**
 * Google sign-in through Supabase Auth: opens Google in an in-app browser
 * session and brings the user back to whiteconnect://auth-callback, where the
 * one-time code (or tokens) are exchanged for a session.
 * Returns false when the user closed the browser.
 */
export async function signInWithGoogle(): Promise<boolean> {
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw error;
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success') return false;
  await completeAuthRedirect(res.url);
  return true;
}

/** Finishes sign-in from the redirect URL (PKCE `?code=` or implicit `#access_token=`). */
export async function completeAuthRedirect(url: string): Promise<void> {
  const params = new URLSearchParams([url.split('?')[1]?.split('#')[0], url.split('#')[1]].filter(Boolean).join('&'));
  const err = params.get('error_description') ?? params.get('error');
  if (err) throw new Error(err);
  const code = params.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // on Android the deep link can also land on /auth-callback; whichever exchange wins, a session is enough
    if (error && !(await supabase.auth.getSession()).data.session) throw error;
    return;
  }
  const access_token = params.get('access_token'), refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
  }
}
