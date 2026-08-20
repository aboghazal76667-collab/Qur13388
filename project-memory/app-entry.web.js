/**
 * Web entry.
 *
 * Identical to the stock `expo-router/entry` except for what a standalone
 * single-file build needs (EXPO_PUBLIC_STANDALONE=1).
 *
 * Such a build is opened from wherever it happens to be hosted — an artifact
 * URL, a file saved on a phone — so two things have to change:
 *
 *   1. The router is pinned to the root route instead of reading
 *      `window.location`. Without this the host's path is matched against the
 *      app's routes, finds nothing, and renders "Unmatched Route".
 *
 *   2. The address bar is frozen. Pinning the initial location is not enough:
 *      the router still calls `replaceState` on every navigation, so the URL
 *      drifts from the host's path to `/family`, and a refresh then asks the
 *      host for a route it has never heard of. A standalone build has no real
 *      URLs to link to, so the address bar has no job — keeping navigation in
 *      memory means a refresh reloads the app rather than a dead link.
 *
 * Both are off by default, so an ordinary web deployment keeps real URLs and
 * working deep links.
 */
import '@expo/metro-runtime';

import { ctx } from 'expo-router/_ctx';
import { ExpoRoot } from 'expo-router/build/ExpoRoot';
import { Head } from 'expo-router/build/head';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';

const STANDALONE = process.env.EXPO_PUBLIC_STANDALONE === '1';

/**
 * Runs before `renderRootComponent`, and so before the router navigates. The
 * router reaches for `window.history.replaceState` at call time rather than
 * capturing it up front, which is what makes replacing it here early enough.
 *
 * `history.state` is read back by the router, so it has to keep behaving.
 */
function freezeAddressBar() {
  if (typeof window === 'undefined' || !window.history) return;

  let state = window.history.state;
  Object.defineProperty(window.history, 'state', {
    get: () => state,
    configurable: true,
  });

  window.history.pushState = (next) => {
    state = next;
  };
  window.history.replaceState = (next) => {
    state = next;
  };
}

export function App() {
  return (
    <Head.Provider>
      <ExpoRoot context={ctx} {...(STANDALONE ? { location: '/' } : null)} />
    </Head.Provider>
  );
}

if (STANDALONE) freezeAddressBar();

renderRootComponent(App);
