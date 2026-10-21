import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { completeAuthRedirect } from '../src/lib/googleAuth';
import { Loading, Screen } from '../src/components/ui';

/** Landing route for whiteconnect://auth-callback (Google sign-in) — finishes the session and goes home. */
export default function AuthCallback() {
  const params = useLocalSearchParams();
  useEffect(() => {
    (async () => {
      const url = (await Linking.getInitialURL()) ?? '';
      if (url.includes('auth-callback')) { try { await completeAuthRedirect(url); } catch { /* the sign-in screen shows the error */ } }
      router.replace('/');
    })();
  }, [params]);
  return <Screen><Loading /></Screen>;
}
