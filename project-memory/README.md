# Project Memory

A long-term childhood memory archive. Parents keep photos, notes and messages
for each child, year after year, and turn a favourite photo into a 3D figurine
they can hold.

This repository is the working product: an Expo mobile app, a Supabase schema
with the privacy rules enforced in the database, and a small server that holds
the AI provider credentials so the phone never has to.

---

## Start here (no programming needed)

You need one thing installed on your computer: **Node.js 20 or newer**, from
[nodejs.org](https://nodejs.org). Then, in a terminal:

```bash
cd project-memory
npm install
npm start
```

A QR code appears. On your iPhone:

1. Install **Expo Go** from the App Store.
2. Open the Camera app and point it at the QR code.
3. Tap the notification that appears.

Project Memory opens on your phone. On Android, open Expo Go and scan the QR
code from inside the app.

**You do not need a Supabase account, an API key, or a server to do this.** The
app runs entirely on your phone until you decide otherwise, and everything works
— accounts, children, memories, photos, photo quality, 3D generation, the
archive, settings, privacy controls and the admin view.

### The demo family

On first launch the app creates a demo account so you can look around:

- Email: `demo@projectmemory.app`
- Password: `memories2026`

It contains **Ghazal** and **Aya** with a few memories. There are no
photographs in it — real children's photographs must never live in a code
repository, so the profiles show initials until you add your own.

You can also just create your own account from the sign-up screen.

### The flow to try

Sign in → Your family → Ghazal → Add a memory → choose *Birthday* → add a photo
→ read the photo quality feedback → Save memory → **Create 3D memory** → watch
the progress → keep the result on the timeline.

That whole path works today.

---

## What is real and what is a placeholder

Being precise about this matters more than making the product sound finished.

**Real and working:**

- Onboarding, sign-up and sign-in
- Family dashboard, child profiles, ages and upcoming birthdays
- Memory creation with up to 5 photos, notes and a message for later
- Child identity: what each child loves, recorded as history so it can change as they grow
- 3D readiness: genuine pixel analysis of each photo, plus coverage guidance across the set
- A real 3D viewer rendering the actual generated model, with drag and pinch
- Likeness feedback: "does this look like your child?", kept for comparing methods
- 3D generation as a complete workflow: request, progress, failure, retry, result
- The archive across every child, with year grouping
- Settings, language switching (English and Arabic), privacy controls, data export, deletion
- An admin view with the QA queue, job list, failures and cost ledger
- Row-level security policies, verified against a real Postgres

**Deliberate placeholders, and labelled as such in the app:**

- **3D generation runs on a mock provider.** It simulates a real generation,
  including occasional failures, and produces a demo figurine drawn on the
  device. It never pretends to be a likeness of your child. Connecting Meshy is
  a config change — see [AI_PROVIDERS.md](docs/AI_PROVIDERS.md).
- **3D readiness measures real pixels but cannot see faces or bodies.** Blur,
  exposure, framing, background and duplicates are genuinely measured. Person,
  face, body and view detection are not implemented — the app says so, and asks
  the parent which photo shows what rather than guessing.
- **Printability is never checked.** No provider assesses it and we have not
  written our own pass, so the result screen says "Print check: Not performed"
  and human QA is the gate before anything is manufactured.
- **Apple and Google sign-in** are architected but not credentialed. The buttons
  explain that rather than failing silently.
- **Memory plans** show pricing placeholders. No payment provider is connected
  and no card details are collected.
- **Time capsule, personalised stories and reminders** exist in the database and
  in the interfaces, and are marked "Coming soon" where they appear.

Nothing in the app is a button that silently does nothing.

---

## Repository layout

```
project-memory/
  app/                  Screens and routes (Expo Router)
  src/
    ui/                 Design system primitives
    theme/              Colour, spacing, type tokens
    i18n/               English and Arabic, RTL support
    domain/             Types, ages, occasions — the model
    data/               Backend abstraction
      local/            Device storage backend (default)
      supabase/         Cloud backend
    services/
      photoQuality/     Quality analyzer abstraction
      threeD/           Generation pipeline and mock simulator
      analytics/        Metrics abstraction
      photos/           Image picking
    features/           Screen-specific components
    state/              Stores (session, archive, settings)
  server/               The AI router — the only place API keys live
  supabase/migrations/  Schema, RLS, storage policies, functions
  tests/                Unit tests for the pure logic
  docs/                 Architecture, database, providers, privacy, decisions
```

---

## Commands

| Command | What it does |
| --- | --- |
| `npm start` | Run the app; scan the QR with Expo Go |
| `npm test` | Run the unit tests |
| `npm run typecheck` | Check types across the app |
| `npm run ios` / `npm run android` | Open in a simulator, if you have one |
| `npm run web` | Open in a browser |
| `npm run build:web` | One self-contained HTML file of the whole app |
| `npm run server:install` | Install the server's dependencies |
| `npm run server` | Run the AI router locally |

---

## Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the pieces fit and why
- [DATABASE.md](docs/DATABASE.md) — the schema and how to extend it
- [AI_PROVIDERS.md](docs/AI_PROVIDERS.md) — the provider abstraction, and connecting Meshy
- [PRIVACY.md](docs/PRIVACY.md) — what we store, and the rules that protect it
- [DEVELOPMENT.md](docs/DEVELOPMENT.md) — setup, Supabase, deployment, troubleshooting
- [DECISIONS.md](docs/DECISIONS.md) — the architecture decision record
