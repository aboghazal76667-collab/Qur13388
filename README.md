# Omani Dishdasha AI

A mobile platform for custom **Omani dishdasha** tailoring — a design studio, a
digital measurement profile, and a workshop operating system in one app.

The product bet is not "another tailoring marketplace". It is that the most
valuable thing a tailor owns is his memory of a customer — his measurements,
his usual fabric, the embroidery he always asks for — and that digitising that
relationship makes ordering another dishdasha as easy as ordering coffee.

> **Codename.** `OMANI DISHDASHA AI` is a working title. Every user-visible
> occurrence of the product name comes from `dishdasha/src/config/brand.ts`, so
> the commercial brand is a one-file change.

---

## Run it

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** on iPhone. No `.env`, no Supabase project, no
payment merchant account and no AI key are required — see [Demo modes](#demo-modes).

```bash
npm run typecheck   # tsc --noEmit
npm test            # 70 unit tests, no Jest toolchain needed
npm run verify      # both
npm run web         # run in a browser
npm run build:web   # static export
```

### The journey to try first

1. **تجربة التطبيق** on the welcome screen → loads the seeded demo customer.
2. Home shows *his* dishdasha, his live order, his saved designs.
3. **صمّم دشداشتك** → fabric → colour → embroidery → **thread colours**.
   Change thread 2 alone and watch only that thread recolour.
4. Zoom the preview into **الياقة / الصدر / الكم / الفراخة**.
5. **اقتراحات الذكاء** → pick an occasion → apply a palette.
6. Review → save the design → **شاهدها بشكل واقعي**.
7. Add to cart → checkout → **Demo Payment — failure**, then **— success**.
8. Track the order; then Profile → *أدوات المطوّر* → **لوحة الخيّاط** to see the
   same order as a production ticket, and advance its stage.

---

## Demo modes

| Flag | Default | Effect when on |
|---|---|---|
| `EXPO_PUBLIC_DEMO_MODE` | `1` | Seeded catalogue, demo customer, instant login |
| `EXPO_PUBLIC_MOCK_AI_MODE` | `1` | Local harmony stylist, simulated previews, no vendor calls |
| `EXPO_PUBLIC_MOCK_PAYMENT_MODE` | `1` | Simulated checkout with explicit success **and failure** buttons |
| `EXPO_PUBLIC_ROLE_SWITCHER` | `1` | Customer / tailor / admin switcher in Profile |

Turning a flag off swaps in the production adapter for that concern only. See
`.env.example`; **no secret ever belongs in an `EXPO_PUBLIC_` variable.**

**Demo credentials:** none. `تجربة التطبيق` signs in the seeded customer
(سالم — tailor-verified measurements, three past orders, five saved designs).
Phone and email sign-in are wired to the same demo session until OTP is enabled.

---

## What is real, what is mocked

Honest labelling is a product requirement here, not a footnote. The customer
demo is polished; this table is the truth behind it.

### Working — real logic, runs offline

- **Layered vector garment renderer.** Silhouette, fabric colour, weave
  texture, sheen, collar, placket embroidery, cuffs, furakha and shading are
  separate SVG layers. Recolouring repaints one layer on the same frame as the
  tap.
- **Independent embroidery thread channels.** 15 original motifs; changing
  channel 2 repaints only channel-2 paths.
- **Deterministic colour harmony engine.** Analogous / complementary / split /
  monochromatic / tonal / neutral-accent, with asymmetric contrast scoring and
  warm-cool balance. Same input → same palettes, always.
- **Pricing.** OMR at three decimals via integer minor units. Merchant-controlled
  tax; no rate is assumed.
- **Design serialisation + stable hashing.** The structured config is the source
  of truth; the hash drives preview caching and reorder matching.
- **Measurement templates, validation, unit conversion, alteration deltas.**
- **Order workflow.** 11 operational statuses → 5 customer-facing stages, every
  transition timestamped.
- **Style memory.** Derived from orders and favourites; drives "order my usual".
- **Cart, checkout, order creation, tracking, alterations, reorder.**
- **Tailor dashboard + digital tailoring ticket.**
- **Demo admin.** Catalogue and price edits flow through to the studio live.
- **Arabic-first UI with runtime-switchable RTL.**
- **Local analytics** with a session funnel.

### Mocked — clearly labelled in the UI

- **Realistic preview.** `SimulatedPreviewProvider` returns a `simulated:` asset
  rendered by the high-fidelity vector renderer. Every asset carries
  `isSimulated: true` and the screen shows *"معاينة محاكاة (وضع تجريبي) — ليست
  ناتج ذكاء اصطناعي حقيقي"*. **It is not AI output and never claims to be.**
- **Virtual try-on.** Same simulation, behind explicit consent.
- **Payments.** `MockPaymentProvider`. No money moves. Both outcomes reachable.
- **Kumma / mussar colour extraction.** *Genuine* canvas quantisation on web;
  **simulated** on native (Expo Go has no pixel access without a native module).
  The UI states which one produced the result.
- **AI stylist provenance.** The palettes are really computed — by a local
  colour-theory engine, not an LLM. The screen says so.

### Not implemented

- Real AI image generation (adapter written, no vendor wired).
- Thawani payments (adapter written; needs a merchant account + webhook server).
- Live Supabase (schema, RLS and adapter written; not yet run against a project).
- OTP sign-in, push notifications, delivery-company integration.
- Camera body measurement — **deliberately** reported as unavailable rather than
  faked. See `services/measurement/provider.ts`.
- Tailor-uploaded embroidery catalogues (modelled, no upload UI).
- Billing for any revenue model (data structures allow them; none implemented).
- Other GCC garments — modelled throughout, intentionally not exposed.

---

## Architecture

```
dishdasha/
  app/                        expo-router routes (thin screens only)
    (tabs)/                   home · design · orders · saved · profile
    stylist · preview · compare · kumma · photo-consent
    cart · checkout · order/[id] · alteration/[orderId]
    measurements/ · fabrics · patterns · tailors · tailor/[id]
    dashboard/ · dashboard/order/[id]      tailor operating system
    admin/ · legal/[doc]
  src/
    config/     brand · env flags · market (currency, tax, language)
    i18n/       ar + en dictionaries, direction helpers, LTR isolation
    theme/      design tokens
    domain/     types · garment registry · measurement templates
    data/       colours · fabrics · embroidery · tailors · demo · palettes · legal
    engine/     color · colorHarmony · money · pricing · design · measurements
                orders · styleMemory          ← pure, tested, no React
    services/   ai/ · payment/ · analytics/ · backend/ · measurement/
    store/      zustand + AsyncStorage persistence
    components/ ui/ · dishdasha/ (renderer) · cards
    hooks/      usePricing · useStyleMemory
    features/   studio/ panels
  tests/        dependency-free harness + 70 assertions
supabase/migrations/  0001 schema · 0002 RLS · 0003 storage
```

**Layering rule.** `engine/` is pure TypeScript with no React and no I/O — which
is why it is the part under test. `services/` owns every external boundary.
`app/` screens compose; they never call a vendor or do arithmetic.

### The two visualisation layers

**Layer 1 — instant configurator.** Vector layers over a shared geometry
(`components/dishdasha/geometry.ts`). Colour changes are a repaint: no network,
no regeneration, no cost. Zoom targets are viewBox crops of the same geometry,
so a detail view can never drift out of alignment with the garment.

**Layer 2 — realistic preview.** `ImageGenerationService` behind a provider
registry. Mock today, hosted model later, identical interface. Results cache by
design hash, and a low-resolution pass exists before committing to a high one.

### AI provider abstraction

`services/ai/index.ts` is the only place a provider is chosen:

```ts
ColorRecommendationService   local harmony engine │ remote LLM ranking
ImageGenerationService       simulated vector     │ hosted image model
ColorExtractionService       canvas (web) / simulated (native)
VirtualTryOnService          simulated, consent-gated at the service boundary
MeasurementEstimationService reports unavailable — not faked
```

Screens never construct a provider. Remote adapters call **our** server, never a
vendor directly, so keys stay server-side. Every call is timed and logged with
provider, model, latency, cost estimate and a **design hash only** — never a
photo URI, never a measurement.

### Payment abstraction

`PaymentProvider` encodes two rules: the client holds no merchant secret, and
the client's word is not proof of payment. `MockPaymentProvider` is the default;
`ThawaniPaymentProvider` posts to our server for session creation and reads back
only what the server verified from Thawani's webhook. The RLS policies grant no
client write on `payments` at all, so this is enforced in the database too.

### GCC expansion

Nothing in the schema or the domain types is named after the Omani dishdasha
except the *rows*. `garment_types`, `garment_components`, `customization_zones`,
`measurement_templates` and `regional style families` are all generic. Adding a
UAE kandura is a `GarmentType` record plus motifs and a measurement template —
no core rewrite. Only `OMANI_DISHDASHA` is `enabled`, so nothing else surfaces.

---

## Supabase

```bash
supabase db push          # or run the three files in order
```

- `0001_init.sql` — 37 tables, UUID keys, `created_at`/`updated_at`, soft delete
  where production history depends on a row.
- `0002_rls.sql` — RLS **enabled and forced** on every table. A customer cannot
  read another customer's measurements, orders, addresses, designs or photos. A
  workshop sees a measurement profile *only* while it holds an order that
  references it. `photo_assets` has no tailor policy and no admin policy at all.
- `0003_storage.sql` — public `catalog`/`previews`, private `customer-photos`
  partitioned by `auth.uid()` and served by signed URL.

Then `npm install @supabase/supabase-js react-native-url-polyfill` and set the
two `EXPO_PUBLIC_SUPABASE_*` variables. The adapter loads through a runtime
require so an unconfigured install keeps working offline.

---

## Privacy

Measurements and customer photos are treated as sensitive personal data in
product design, whatever their legal classification.

- Photos are **optional**; you can design and buy without one.
- Nothing is processed until explicit consent plus a deliberate tap.
- Photos are session-scoped unless the customer opts into storage, and there is
  a delete control.
- Measurement data and try-on imagery are separate concerns and separate tables.
- Marketing consent is separate from operational notifications and defaults off.
- Data export and account deletion are wired in Profile → الخصوصية والبيانات.

Privacy, Terms, Returns, Alterations and Custom-made policies ship as **drafts**
marked *"تتطلب مراجعة قانونية قبل الإطلاق"* in the app itself. This software does
not guarantee legal compliance; Oman PDPL obligations need counsel before launch.

---

## Known limitations

- Garment art is **vector placeholders**, not photographed tailoring. The layer
  API is what real assets would slot into.
- Fabric brand names are invented and flagged `isDemoData`. No factual claim is
  made about any real mill. Tailors are fictional; ratings are `null`, not
  invented.
- Native colour extraction is simulated (labelled).
- Everything persists to device storage in demo mode; clearing app data resets.
- Deep links need SPA fallback when self-hosting the web export.
- No offline queue: a failed action retries, it does not replay later.

## Production checklist

- [ ] Replace brand, legal entity and support contacts in `config/brand.ts`
- [ ] Legal review of all five policy drafts (Oman PDPL included)
- [ ] Apply migrations; verify RLS with a second test account before launch
- [ ] Stand up the server: AI proxy, Thawani session creation, **webhook verification**
- [ ] Turn off `MOCK_PAYMENT_MODE`; confirm no order is ever marked paid client-side
- [ ] Replace demo fabrics/tailors with real merchant inventory
- [ ] Photograph real fabric swatches and vectorise real embroidery patterns
- [ ] Configure tax per merchant (no rate is assumed anywhere)
- [ ] Set photo retention and expiry jobs for `photo_assets`
- [ ] Move any native-only feature to an EAS development build
- [ ] Load-test preview caching before enabling paid generation

---

See [`PRODUCT_DECISIONS.md`](./PRODUCT_DECISIONS.md) for the reasoning behind the
choices above, and [`ROADMAP.md`](./ROADMAP.md) for what comes next.

> This repository also contains an unrelated earlier project (`app/`, `src/`,
> `server/`) preserved on the `claude/quran-intelligence-mvp-in0txn` branch.
> It is inactive: Expo Router is pointed at `dishdasha/app` in `app.json`.
