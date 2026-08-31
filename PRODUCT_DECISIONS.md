# Product & architecture decisions

Why the code looks the way it does. A future session should read this before
"simplifying" something here — several of these choices look like extra work
and are load-bearing.

---

## 1. The structured design config is the product, not the picture

A saved design stores a `DesignConfig` (fabric, colour, pattern, per-channel
threads, furakha, component options) plus a stable hash. A rendered image is a
derivative artefact.

**Why.** A screenshot cannot be reordered in a new colour, cannot be repriced
when a fabric changes, cannot be cut from, and cannot be compared. Every
valuable behaviour in this product — reorder, "same order, new colour", compare,
preview caching, the tailor's ticket — depends on the configuration being
structured data.

**Do not** add a code path where a design exists only as an image.

## 2. Two visualisation layers, and the cheap one is the default

Layer 1 is a layered SVG garment: colour changes repaint one layer on the same
frame as the tap. Layer 2 is a provider-backed photorealistic render behind an
explicit button.

**Why.** Calling a generative model on every swatch tap would be slow, offline-
hostile, and financially ruinous at scale — a customer trying twenty thread
colours is normal behaviour. The expensive path must be opt-in and cached.

## 3. Embroidery threads are separate render channels

Each motif draws its channel-1, channel-2 and channel-3 elements with distinct
colour props. Changing thread 2 repaints only thread-2 paths.

**Why.** This mirrors a real embroidery head changing one spool, and it is the
single most convincing moment in the demo. A "recolour the whole pattern"
shortcut would destroy the feature.

## 4. Candidate palettes are computed deterministically; AI ranks and explains

`engine/colorHarmony.ts` generates candidates from colour theory. The stylist
service ranks them against style memory and writes the explanation.

**Why.** The stylist works offline, costs nothing, is instant, and is testable —
`generateHarmonyCandidates` is a pure function with a determinism test. An LLM
that invents RGB values produces tasteless output and unpredictable cost. When a
hosted model is added it should replace *ranking and prose*, not generation.

## 5. Neutrality is measured by chroma, not HSL saturation

`isNeutral` uses `max−min` channel spread, not `hsl().s`.

**Why (found by a test).** HSL reports off-white `#F2EDE3` at ~37% saturation.
That classified the most common dishdasha colour in Oman as a strong hue, which
made navy-on-off-white score as a *complementary clash*. Chroma reports it at
~6%, matching the eye. Do not "simplify" this back to `.s`.

## 6. Contrast scoring is asymmetric

Below the target ratio the penalty is steep to zero; above it the score decays
gently and floors at 0.55.

**Why (also found by a test).** A symmetric curve scored an invisible
white-on-off-white thread *higher* than navy on off-white, because navy sits
near ratio 9. The two failure modes are not equal: too little contrast ruins the
garment, too much is a legitimate bold choice.

## 7. OMR arithmetic goes through integer minor units

Every amount is converted to baisa, summed as integers, and rounded once.

**Why.** OMR has three decimals. `0.1 + 0.2` in floating point is a wrong total
on a real invoice, and a tailoring order sums many small surcharges.

## 8. Tax is never assumed

`MARKETS.OM.taxRate` is `null`, meaning "not configured". The pricing engine
omits the line entirely and the UI says so.

**Why.** Tax treatment of made-to-measure goods is a merchant's legal position,
not a platform default. Hardcoding a rate would be quietly wrong.

## 9. Measurement templates are data; there is no universal Omani method

A workshop selects or defines a template. Two ship by default.

**Why.** Tailors genuinely measure differently. Assuming one method would force
every workshop to translate its own practice into ours — the exact friction the
product is meant to remove.

## 10. Measurement validation warns generously and blocks rarely

Ranges are wide; cross-field checks produce warnings, not errors.

**Why.** A real customer can sit outside "typical". Refusing someone's true
measurement is worse than a soft warning. Only impossible values block, because
those are always typos.

## 11. A measurement is never changed silently

After an alteration the app asks, shows the exact before → after, and only then
applies the delta — demoting the profile to `needs_review`.

**Why.** This is the learning loop that compounds into the moat, and it is also
the one place where being wrong ruins every future order. Consent is cheap;
a silently wrong sleeve length is not.

## 12. Orders freeze their measurement snapshot

`order_items.measurement_snapshot` is a frozen copy, and profiles are
soft-deleted.

**Why.** A customer editing his profile must not retroactively change what a
workshop was told to cut. Production history has to stay stable.

## 13. Eleven operational statuses, five customer stages

The workshop sees the full flow; the customer sees a friendly five.

**Why.** "Fabric allocated" is noise to a customer and essential to a cutter.
One model, two projections — not two models.

## 14. Camera body measurement is reported as unavailable, not faked

`MeasurementEstimationService.available === false` and `estimate()` throws.

**Why.** A plausible-looking wrong measurement produces a garment the customer
paid for and cannot wear. The interface exists so a *validated* provider can be
dropped in; pretending is worse than absence.

## 15. Simulated output is always labelled

Previews carry `isSimulated`, extraction reports whether it read the photo, the
stylist says it runs on a local engine, and checkout says no money moves.

**Why.** The demo should be polished and honest at the same time. A investor or
tailor discovering later that "AI preview" was a vector drawing costs more trust
than the feature ever earned.

## 16. Payment status is a server fact

No client policy can insert or update `payments`. The Thawani adapter reads back
only what the server verified from a webhook.

**Why.** "The client said it paid" is not payment. This is enforced in RLS, not
just in code, so a tampered build cannot mark an order paid.

## 17. Photos are optional, consent-gated at the service boundary, and unshared

`VirtualTryOnService.render` throws without a consent timestamp. `photo_assets`
has **no** tailor policy and **no** admin policy in RLS.

**Why.** A workshop never needs a customer's body photo to cut a garment. Making
consent a service-level invariant means no screen can accidentally skip it.

## 18. AI telemetry logs a design hash, never imagery

**Why.** Cost accounting and debugging need provider, model, latency and a
cache key. They do not need a customer's photo URI, and a log dump should not be
able to leak one.

## 19. RTL is done in layout, not via `I18nManager.forceRTL`

Rows derive `flexDirection` from the language; text sets `writingDirection`.

**Why.** `forceRTL` needs a native reload, which breaks in-app language
switching and Expo Go demos. This way Arabic and English switch instantly and
both feel native. `ltr()` isolates hex codes and phone numbers — without it a
thread reference renders as `EFE7D6#`, which a workshop would misread.

## 20. Schema names garments generically; only rows are Omani

`garment_types`, `garment_components`, `customization_zones`,
`measurement_templates`. Only `OMANI_DISHDASHA` is enabled.

**Why.** The whole GCC expansion thesis dies if "dishdasha" is a column name.
Adding a kandura must be an INSERT, not a migration.

## 21. Supabase is an optional runtime dependency

The adapter loads via `require` inside `try`/`catch`; the SDK is not in
`package.json`.

**Why.** The promise is that this runs in Expo Go with zero setup. A hard import
drags the SDK and its polyfills into every bundle and creates a class of
"works on my machine" failures for a feature most users have not configured.

## 22. `engine/` is pure; that is why it is the tested part

No React, no I/O, no platform APIs.

**Why.** The valuable logic — harmony, money, hashing, validation, workflow — is
testable with no simulator and no Jest/Babel toolchain to keep in sync with
Expo. The 70 tests run under `tsx` in about a second.

## 23. The demo customer is not decoration

He has tailor-verified measurements, three past orders, five saved designs and a
live order mid-production.

**Why.** An empty first run cannot demonstrate the product's actual thesis. Home
is only convincing when it is *his* dishdasha on it.

## 24. Demo tailors have `null` ratings

**Why.** Fabricating a 4.8 for a fictional business trains everyone to distrust
every number in the app. The rating architecture exists; the data does not yet.

---

## Things deliberately NOT done

- No generative AI on the configurator path (see #2).
- No third-party analytics SDK; local sink only, no identifiers.
- No forced registration in demo mode.
- No other GCC garment exposed, however easy the data would be.
- No revenue-model billing implemented — only structures that permit it later.
- No claim, anywhere, that this software guarantees legal compliance.
