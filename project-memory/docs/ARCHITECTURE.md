# Architecture

## The shape of the system

```
┌──────────────────────────────────────────────┐
│  Mobile app (Expo + React Native + TS)       │
│                                              │
│  Screens ─▶ Stores ─▶ MemoryBackend          │
│                          │                   │
│              ┌───────────┴──────────┐        │
│              ▼                      ▼        │
│      LocalBackend            SupabaseBackend │
│    (device storage)          (cloud)         │
└──────────────────────────┬───────────────────┘
                           │  no vendor keys ever cross this line
                           ▼
              ┌────────────────────────────┐
              │  Project Memory API        │
              │  (server/)                 │
              │                            │
              │  auth ─▶ AI Router ─▶ 3D provider
              │            │               │
              │            ▼               │
              │      cost ledger           │
              └────────────┬───────────────┘
                           ▼
                Meshy · Tripo · self-hosted · mock
```

## The three seams that matter

Everything else is detail. These three are what let the product change without
being rewritten.

### 1. `MemoryBackend` — storage is replaceable

Every screen talks to `MemoryBackend` (`src/data/backend.ts`) and to nothing
else. Two implementations ship:

- **`LocalBackend`** — a JSON document in AsyncStorage plus files in the app's
  private documents directory. It is the default, and it is why the founder can
  run the whole product on an iPhone before creating any cloud account.
- **`SupabaseBackend`** — Postgres, Auth and private Storage.

Selection is one line in `src/data/index.ts`, driven by whether
`EXPO_PUBLIC_SUPABASE_URL` is set. A third backend would be a new class and a
new case; no component would change.

The two implementations are deliberately kept behaviourally identical. Every
rule the database enforces with row-level security, `LocalBackend` enforces in
code — because the two must not disagree about what privacy means.

### 2. `ThreeDProvider` — no AI vendor is load-bearing

`src/services/threeD/provider.ts` defines the contract:
`generateFromImage`, `generateFromMultiView`, `checkStatus`, `downloadModel`,
`analyzePrintability`, plus a `capabilities` block.

The file is shared, by re-export, between the app and the server: the app uses
the types, the server implements them. A duplicated interface is one that
drifts.

Three implementations exist (`server/src/providers/`): `Mock3DProvider`,
`MeshyProvider`, `TripoProvider`. The router picks between them. Switching
providers is an environment variable — `server/src/router.test.ts` asserts
exactly that, so it stays true.

### 3. `PhotoQualityAnalyzer` — the scorer is replaceable

`src/services/photoQuality/types.ts` defines the interface; the shipping
implementation scores from image properties and reports
`inspectsPixels: false`. The UI reads that flag and words the panel honestly. A
real vision model implements the same interface and no screen changes.

## Why the app never calls an AI provider

The mobile bundle is public. Anything in it — including every `EXPO_PUBLIC_*`
variable — can be read by anyone who downloads the app. A Meshy key in the
bundle is a Meshy key on the internet.

So the app asks our server, the server holds the credentials, and the server
calls the provider. This also gives us the one place where cost and reliability
data can be recorded for every call, which is what the router will eventually
use to choose between providers automatically.

The Supabase anon key *is* in the bundle, and that is fine: it is designed for
it, and row-level security is what actually protects the data.

## The 3D pipeline

Fourteen internal states; five sentences the parent sees.

```
uploaded → image_checked → generating → raw_model_ready
        → quality_review → printability_check → approved
        → print_ready → ordered → printing → shipped → delivered
                                                     ↘ failed
```

The mapping lives in `src/services/threeD/pipeline.ts`, so the progress screen
never has to know what `printability_check` is and the admin panel never has to
guess what a family is looking at.

A retry creates a **new job** that points at the old one through
`retry_of_job_id`, reusing the same source photos. The memory and the
photographs are never touched by a retry — which is what lets the failure screen
honestly say "your photos are safe".

`isAwaitingResult()` keys on `completed_at` rather than on the status, because
several statuses are past generation but before there is anything to show. An
earlier version keyed on the status and deadlocked the progress screen; the test
`a job is only finished when it has an outcome` exists to stop that returning.

## State

Three small Zustand stores, each with one job:

- `useSettings` — language, appearance, whether onboarding has been seen. Device
  scoped, so it survives signing out.
- `useSession` — who is signed in.
- `useArchive` — the family, the children, and their memories.

Writes go straight through to the backend and then refresh. There are no
optimistic updates: a parent believing a memory was saved when it was not is the
single worst bug this product could have.

## Extending it

**A new kind of memory content** (video, audio, a story page, a QR reference):
add an `AssetKind`. Content is modelled as `assets` rows with a `kind` and a
`meta` bag, never as columns on `memories`, so this costs no migration.

**A new memory kind** (`graduation`, say): add it to the check constraint and to
`memoryKindPresentation`. Two lines.

**A new provider**: implement `ThreeDProvider`, register it in `AiRouter`. The
app does not change.

**A new language**: add a catalogue next to `src/i18n/ar.ts`. The test
`Arabic is complete` walks the whole object graph, so a missing string fails
the build rather than shipping as English text in an Arabic app.
