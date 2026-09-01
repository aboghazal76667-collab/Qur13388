# Real 3D renderer — technology decision

Status: **decided and implemented**. The renderer described here is built,
compiles, is covered by tests, and is selected at runtime by
`src/render/rendererAdapter.ts`. It is not yet visible to customers, because
no professional garment asset exists — see
`docs/PROFESSIONAL_3D_ASSET_BRIEF.md`.

---

## 1. What had to be decided

V2 draws the garment. V3 must *render* it: one mesh, one camera, real
rotation, real material response to light. The question was not "how do we
make the SVG look 3D" — that path is closed by design — but "which GPU stack
can carry a real GLB garment inside an Expo application on iOS, Android and
web, today, without ejecting from the managed workflow".

Four candidates were considered.

## 2. Options considered

### A. three.js used directly, on top of `expo-gl` — **CHOSEN**

- `three@0.185.1` plus `GLTFLoader`, driven by a hand-written render loop.
- `expo-gl@~57.0.2` is in Expo SDK 57's `bundledNativeModules.json`, so it
  ships inside **Expo Go** — the app keeps running for reviewers with no
  custom development build.
- On web the same three.js code binds to a plain `<canvas>` WebGL2 context.
- One platform-aware file in the whole renderer: `src/render/real3d/GLSurface.tsx`.

Cost: three.js adds **≈0.89 MB** to the web bundle (1.98 MB → 2.87 MB). That
cost is real, is stated in the V3 report, and is a *download* cost: Metro emits
one bundle for web, so the bytes ship whether or not the code runs. What is
deferred is execution — `GarmentViewer` reaches three.js through a runtime
`require`, so while the asset registry is empty the module is never evaluated
and no GL context is created on a customer device. Code-splitting the renderer
out of the initial bundle is the obvious follow-up once an asset exists.

### B. `@react-three/fiber` + `@react-three/drei`

Rejected, though it is the more fashionable choice.

- React reconciler overhead on every frame during a drag gesture, on a
  mid-range Android device, buys nothing here: this scene has one mesh, four
  lights and one camera. There is no scene graph churn for a reconciler to
  optimise.
- R3F's Expo support tracks a specific React and React Native pairing. This
  app is on React 19.2.3 / RN 0.86.2; pinning the renderer's viability to a
  third-party bridge's release cadence is a standing upgrade risk for a
  feature the whole product is built around.
- `drei` helpers (`OrbitControls`, `Environment`, `Stage`) are convenient and
  would have been the main gain, but each of them is ~40 lines of the code we
  already wrote, and writing them ourselves keeps camera framing under our own
  product rules (long lens, garment at 60–70% of frame) rather than under a
  library default.
- Nothing prevents a later migration: `GarmentRenderer` is an interface. An
  R3F implementation would be a third `RendererKind`, not a rewrite.

### C. Pre-rendered multi-angle image sets (Blender → 36 stills → sprite swap)

Rejected outright. This is the "fake 3D" the sprint forbids. It also fails on
product grounds, not only on honesty grounds: the customer changes fabric,
base colour and three independent thread colours. A pre-rendered set would
have to be regenerated per configuration — a combinatorial explosion that no
CDN budget survives — or recoloured client-side, which is exactly the flat
tinting V2 already does better.

### D. `react-native-filament` / native PBR engines

Rejected for now. Filament produces excellent cloth, but it requires a custom
development build; Expo Go stops working, and with it the zero-install
external review path that this project has depended on twice already. It is
the strongest candidate for a future upgrade once the app moves to EAS builds
and a real asset exists. `GarmentRenderer` is the seam that makes that swap
cheap.

## 3. The abstraction that made the decision safe

```
GarmentSpec → DishdashaVisualEngine → RendererAdapter → { Real3DRenderer | V2FallbackRenderer }
```

`src/render/types.ts` defines `GarmentRenderer`. Both renderers implement it.
Screens talk to `GarmentViewer`, never to three.js:

- `Real3DRenderer` — `RendererKind = 'real3d'`, `capabilities.trueMesh = true`.
- `V2FallbackRenderer` — `RendererKind = 'v2fallback'`, `capabilities.trueMesh = false`,
  and `capturePreview()` returns `null` rather than pretending it produced a
  raster.

Because the contract is the only thing screens know, replacing three.js with
Filament, or adding an R3F variant, touches one directory.

## 4. Expo / React Native limitations we designed around

| Limitation | Consequence | How it is handled |
|---|---|---|
| `expo-gl` gives a GL context, not a canvas | three.js needs `gl.endFrameEXP()` after each frame | `Real3DRenderer.render()` calls it defensively (`gl.endFrameEXP?.()`), so the same loop runs on web |
| No DOM on native | `GLTFLoader` fetch paths differ | Asset URI resolution is the adapter's job; the renderer receives a URI |
| Expo Go cannot load arbitrary native modules | Filament/three-native forks are out | Only `expo-gl`, which is bundled in SDK 57 |
| Device memory varies enormously | A 150k-triangle garment at 3× pixel ratio drops frames | `src/render/quality3d.ts` — HIGH / BALANCED / LOW resolved from pixel ratio, triangle count, detail view and low-power |
| Web WebGL may be absent or blocked | A blank canvas would read as a broken product | `selectRenderer()` falls back to V2 when WebGL is unavailable |
| Bundle size on web | +870 KB is a real cost on a mobile connection | three.js is behind a lazy runtime `require`, loaded only when a customer-ready asset is registered |

## 5. Fallback strategy

`selectRenderer()` returns `v2fallback` — never a broken 3D view — when any of:

1. the force-fallback flag is set,
2. WebGL is unavailable,
3. the device reports low power,
4. **no customer-ready asset is registered** (today's case, always).

`fallbackAfterLoadFailure()` covers the runtime case: a GLB that 404s, fails
to parse, or whose manifest fails `validateManifest()` drops to V2 *with the
customer's design intact*, because both renderers consume the same
`GarmentSpec`. `REASON_LABELS` gives every reason an Arabic and English
string, so the developer inspector can state plainly why the 3D path is not
active.

## 6. Verification

- `npx tsc --noEmit` clean under `strict`.
- 189 tests pass, including renderer selection, manifest validation, camera
  presets, tier resolution, PBR mapping, independent thread channels, and
  `GarmentSpec` propagation through the fallback.
- Web and iOS exports both succeed with the renderer present.

## 7. What this decision does **not** claim

It does not claim the customer sees real 3D today. The engine is complete;
the garment is missing. Until a professional GLB passes
`src/render/visualAcceptance.ts`, `GARMENT_ASSETS` stays empty and every
customer sees the V2 fallback.
