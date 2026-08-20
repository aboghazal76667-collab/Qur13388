import React from 'react';
import { Redirect } from 'expo-router';

import { useSession } from '@/state/session';
import { useSettings } from '@/state/settings';

/**
 * The entry gate: onboarding once, then sign-in, then the family.
 */
export default function Index() {
  const onboardingSeen = useSettings((state) => state.onboardingSeen);
  const status = useSession((state) => state.status);

  if (!onboardingSeen) return <Redirect href="/onboarding" />;
  if (status === 'signed_in') return <Redirect href="/(app)/family" />;
  return <Redirect href="/(auth)/sign-in" />;
}
