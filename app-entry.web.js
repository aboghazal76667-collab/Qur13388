/**
 * Web entry.
 *
 * Identical to the stock `expo-router/entry` except for one thing: when built
 * as a standalone single-file bundle (EXPO_PUBLIC_STANDALONE=1), the router is
 * pinned to the root route instead of reading `window.location`.
 *
 * A standalone build gets opened from wherever it happens to be hosted — a
 * `file://` path, or a URL like `/artifacts/<id>`. The router would try to
 * match that path against the app's routes, find nothing, and render
 * "Unmatched Route" instead of the app. Pinning the initial location sidesteps
 * that without touching browser history.
 *
 * The flag is off by default, so an ordinary web deployment keeps real URLs and
 * working deep links.
 */
import '@expo/metro-runtime';

import { ctx } from 'expo-router/_ctx';
import { ExpoRoot } from 'expo-router/build/ExpoRoot';
import { Head } from 'expo-router/build/head';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';

const STANDALONE = process.env.EXPO_PUBLIC_STANDALONE === '1';

export function App() {
  return (
    <Head.Provider>
      <ExpoRoot context={ctx} {...(STANDALONE ? { location: '/' } : null)} />
    </Head.Provider>
  );
}

renderRootComponent(App);
