# Roadmap

Five stages. Each one has a single question it exists to answer; do not advance
until that question is answered with real people.

---

## Stage 1 — MVP  ·  *shipped in this repository*

**Question:** does seeing the dishdasha before it is stitched change how people
order?

- Arabic-first mobile shell with runtime language switching
- Demo customer with measurements, order history and saved designs
- Measurement profiles: configurable templates, validation, verification status
- Fabric catalogue with texture-aware swatches
- Embroidery library with independent 1/2/3 thread channels
- Instant layered vector configurator with zoom into neck, chest, sleeve, furakha
- Deterministic colour harmony engine
- AI stylist (local engine) with occasion, season, affinity score and reasoning
- Save design, compare, share
- Cart, demo tailor selection, mock checkout with success **and** failure paths
- Order creation and customer tracking
- Quick reorder and "same order, new colour"
- Tailor dashboard and the digital tailoring ticket
- Supabase schema, RLS and storage policies
- Simulated realistic preview + optional consent-gated try-on
- 70 unit tests, typecheck clean, Expo Go compatible

---

## Stage 2 — Pilot with the first tailor

**Question:** does one real workshop stop using WhatsApp screenshots?

- Onboard one workshop; replace demo fabrics with their real inventory
- Photograph their bolts under standardised lighting → real digital swatches
- Vectorise **their** embroidery catalogue with correct channel counts
- Capture their measurement method as a template (do not force ours)
- Live Supabase with RLS verified against a second real account
- Real auth: phone OTP
- Server: AI proxy + Thawani session creation + **webhook verification**
- Turn off `MOCK_PAYMENT_MODE` for a small set of real orders
- Order notifications (operational only; marketing stays off)
- Ship the tailor an EAS build for the workshop tablet

**Exit criteria:** the workshop runs a full week of orders through the ticket
screen without reaching for WhatsApp, and no order is disputed over colour,
thread or measurement ambiguity.

---

## Stage 3 — Oman launch

**Question:** do customers come back without being chased?

- Real photorealistic preview provider behind the existing interface, with the
  cache and low→high pass already built for it
- Cost controls proven: cost per converted order tracked and capped
- Legal review completed for all five policy drafts (Oman PDPL included)
- Data export and deletion served by the backend, not the device
- Consented seasonal reminders (Ramadan, Eid al-Fitr, Eid al-Adha)
- Alteration loop live, including the measurement-update confirmation
- Product metrics dashboard: design→checkout, preview→purchase, repeat rate,
  average order value, alteration rate, fulfilment time
- Real ratings — collected, never seeded

**Exit criteria:** repeat-order rate is the top acquisition channel, and the
alteration rate falls measurably after the measurement loop is live.

---

## Stage 4 — Oman multi-tailor

**Question:** does the platform work when tailors disagree?

- Self-serve workshop onboarding
- Tailor-uploaded embroidery catalogues with channel configuration
- Per-workshop pricing, measurement templates and production stages
- Branch and employee roles enforced by RLS in production
- Delivery-company integration; QR/barcode labels on the production board
- Discovery: search and filter across workshops
- Commission or subscription billing — the first revenue model to actually ship
- Featured placement, kept clearly labelled as such

**Exit criteria:** a workshop can onboard, configure and fulfil without our
involvement, and two workshops with different measurement methods both work.

---

## Stage 5 — GCC expansion

**Question:** does the core hold for a garment that is not the dishdasha?

Add garments as **data**, in this order, one per release:

1. UAE Kandura
2. Saudi Thobe
3. Kuwaiti Dishdasha
4. Qatari Thobe
5. Bahraini Thobe

Each needs: a `GarmentType` record, its components and customisation zones, its
measurement template, its regional motifs, and its market config (currency,
language, tax). Nothing in `engine/`, `store/` or the schema should change — if
it does, the abstraction was wrong and that is the finding.

Also at this stage: additional currencies (AED, SAR, KWD, QAR, BHD — note KWD
and BHD are also three-decimal), per-market tax configuration, and per-country
legal review.

**Exit criteria:** the second garment ships without a core rewrite.

---

## The long-term moat

Measurement history + fit-correction history + craftsmanship data + fabric,
embroidery and styling preferences + repeat behaviour. Each order should make
the next one easier to place and better fitting.

**Constraint that does not bend:** personal data is not used for unrelated model
training without explicit consent and legal review. The moat is the customer's
own profile serving him better — not a dataset sold sideways.
