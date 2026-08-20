# Development

## Running the app

```bash
cd project-memory
npm install
npm start
```

Scan the QR code with the iPhone Camera app (or from inside Expo Go on Android).

The app runs fully on the device with no cloud account. That is the default, and
it is the right way to work on anything that is not specifically about Supabase.

## Everyday commands

```bash
npm test              # unit tests for the pure logic
npm run typecheck     # types across app and tests
npm run web           # open in a browser — useful for quick checks
npm run server        # the AI router, once configured
```

## Setting up Supabase

Only needed when you want a real backend — multiple devices, multiple parents,
or connecting a real 3D provider.

1. Create a project at [supabase.com](https://supabase.com). The free tier is
   enough to start.

2. Apply the migrations in order. In the dashboard: **SQL Editor → New query**,
   paste each file, run it.

   ```
   supabase/migrations/0001_schema.sql
   supabase/migrations/0002_signup.sql
   supabase/migrations/0003_rls.sql
   supabase/migrations/0004_storage.sql
   supabase/migrations/0005_functions.sql
   ```

   Or with the CLI: `supabase db push`.

3. Create `.env` in `project-memory/`:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

   Both are from **Settings → API**. Use the *anon* key, never the service-role
   key — see [PRIVACY.md](PRIVACY.md#no-api-keys-in-the-app).

4. `npm start` again. Settings now shows `Storage: supabase`.

5. Optionally run `supabase/seed.sql` after creating your first account, to add
   the demo children.

To give yourself the admin area, run in the SQL editor:

```sql
update profiles set is_staff = true where email = 'you@example.com';
```

## Connecting a 3D provider

Get the mock path working end to end on a phone first. See
[AI_PROVIDERS.md](AI_PROVIDERS.md#connecting-meshy) for why that ordering
matters, and for the steps.

```bash
cp server/.env.example server/.env   # then fill it in
npm run server:install
npm run server
curl http://localhost:8787/health
```

Point the app at it by adding to `.env`:

```
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.x:8787
```

Use your computer's LAN address, not `localhost` — the phone needs to reach it.

## Testing

```bash
npm test                              # app: ages, scoring, pipeline, i18n, paths
npm --prefix server test              # server: router behaviour
```

The tests cover the logic where being wrong is expensive and silent: ages and
birthdays, photo scoring stability, the generation state machine, storage path
layout, and translation completeness.

**The most important test is not in either suite.** It is the row-level security
verification in [DATABASE.md](DATABASE.md#verifying-it), run against a real
Postgres. Run it after any change to `0003_rls.sql` or `0004_storage.sql`.

## Building for the App Store, eventually

Expo Go is for development. A real release needs EAS:

```bash
npm install -g eas-cli
eas login
eas build --platform ios
```

This requires an Apple Developer account (about 99 USD a year). Do not spend
that money until the product is something you would put in front of a stranger.

## Troubleshooting

**The QR code will not open.** The phone and the computer must be on the same
Wi-Fi. If they are, try `npx expo start --tunnel`.

**A change does not appear.** `npm run dev` (which clears the Metro cache).

**"Cannot find module '@/…'"** — the `@` alias points at `src/`. Check
`tsconfig.json` if you moved something.

**Photos will not pick.** Expo Go asks for photo permission the first time. If
it was denied, re-enable it in iOS Settings → Expo Go → Photos.

**Nothing saves after connecting Supabase.** Almost always a missing migration —
usually `0003_rls.sql`, which the app needs in order to read its own rows. Apply
all five in order.

**Starting over.** Delete the app from your phone and reinstall from the QR
code; the device database goes with it.

## Cost

Everything here runs on free tiers: Supabase free, Expo free, and the mock
provider costs nothing. The first real spend is 3D provider credits, and the
cost ledger will tell you exactly what they buy.
