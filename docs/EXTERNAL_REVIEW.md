# External review build

**Public URL:** https://aboghazal76667-collab.github.io/Qur13388/

Open it in any browser. No account, no login, no Expo Go, no local tooling.
Tap **تجربة التطبيق** to enter as the seeded demo customer.

Served from the `gh-pages` branch, rebuilt by `.github/workflows/pages-review.yml`
on every push to `claude/omani-dishdasha-ai-mvp-9ixppw`. The tree under review is
the `pre-external-audit-v1` branch.

## What the build is

The standalone single-file export: the JS bundle and every asset it reaches for
are inlined, so the page makes zero external requests. It runs with
`DEMO_MODE`, `MOCK_AI_MODE` and `MOCK_PAYMENT_MODE` on — seeded catalogue,
local stylist, simulated previews, simulated payments. No credential of any
kind is present in the bundle, and the workflow fails the build if a
secret-shaped string ever reaches it.

## Web vs. the mobile app

These are differences in how the *same* code behaves in a browser. The mobile
implementation is unchanged; nothing was rewritten to suit the web.

| Area | On mobile (Expo Go) | In this review build |
|---|---|---|
| Camera capture (kumma photo, try-on) | Opens the device camera | `expo-image-picker` maps to a file chooser; on desktop there is no camera roll. Consent gating, the delete control and the rest of the flow behave identically. |
| Kumma colour extraction | **Simulated** — Expo Go has no pixel access without a native module | **Genuine** — real canvas quantisation of the chosen image. The UI states which one produced the result. |
| Share design | Native share sheet | Browser share sheet where supported, otherwise a no-op |
| Haptics / push notifications | N/A — not used by the MVP | N/A |
| Persistence | AsyncStorage | `localStorage`. A private window, or a browser blocking site data, resets the demo. |
| Deep links | N/A | The build pins the router to the site root, so any URL opens at Home. In-app navigation and refresh both work; a shared inner URL lands on Home rather than that screen. |

## Resetting the demo

The reviewer's progress lives in their own browser. To start clean:
حسابي ← الخصوصية والبيانات ← حذف الحساب, or open the link in a private window.

## Verification

The exact bytes GitHub serves were checked against a GitHub Pages simulator
(sub-path serving plus 404.html fallback): 29/29 reviewer steps pass with zero
console errors, and a reload on an in-app URL recovers. The CI-produced bundle
is byte-identical to the one tested.
