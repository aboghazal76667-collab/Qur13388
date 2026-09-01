# Omani Dishdasha — visual standard

The reference the renderer is built against. Every constant in
`src/visual/` traces back to a line in this document.

Each item carries a status:

| Status | Meaning |
|---|---|
| **VERIFIED** | Widely-documented, defining characteristic of the Omani dishdasha. Safe to render as "Omani". |
| **REFERENCE_REQUIRED** | Plausible tailoring value used as a configurable placeholder. **Not** presented to customers as traditional. Must be replaced with tailor-supplied data. |
| **EXPERIMENTAL** | Our own construction for demo purposes. Never labelled traditional. |

> **Rule.** Nothing marked REFERENCE_REQUIRED or EXPERIMENTAL may be shown with
> a "تقليدي / traditional" label in the UI. `classification: 'unverified'`
> already enforces this in the embroidery catalogue.

---

## 1. Silhouette — VERIFIED

The Omani dishdasha is an ankle-length, loose, **collarless** robe with a
straight-to-slightly-A-line fall and long, loose sleeves. It is not fitted and
must never be rendered as body-hugging.

What distinguishes it from neighbouring garments, and what the renderer must
never do:

| | Omani dishdasha | Must not render as |
|---|---|---|
| Neckline | **No collar.** A plain round/oval opening finished with a narrow bound edge | Saudi thobe's stand or shirt collar |
| Front | A short **shaq** (slit) at centre front below the neckline | Full button placket down the chest |
| Signature | **Furakha** — a thread tassel hanging from the neckline | Any garment without one |
| Cuffs | Soft, unstructured sleeve opening | Emirati kandura's stiff shirt cuff with links |
| Fastening | Minimal; no visible button band | Western shirt front |

## 2. Proportions — REFERENCE_REQUIRED (plausible tailoring values)

Canonical size used when no measurement profile is selected. These come from
the platform's own default measurement template, not from a documented Omani
tailoring spec, so they are placeholders.

| Landmark | Value | Note |
|---|---|---|
| Total length | 1460 mm | shoulder-neck point to hem, above the ankle |
| Shoulder width | 470 mm | across the back |
| Chest circumference (body) | 1040 mm | + ~100 mm garment ease |
| Hem sweep | 1300 mm | circumference |
| Sleeve length | 620 mm | shoulder point to opening |
| Cuff opening | 240 mm | circumference |
| Neck circumference | 410 mm | |

**Ease rule.** Garment circumference = body measurement + ease. Measurements
change tailoring proportions; they never deform the garment toward the body.
Ease is clamped so the silhouette stays loose at every size.

## 3. Neckline — VERIFIED (shape) / REFERENCE_REQUIRED (dimensions)

Collarless, bound with a narrow finished edge. Embroidery follows that edge.

| Dimension | Value | Status |
|---|---|---|
| Opening half-width | 78 mm | REFERENCE_REQUIRED |
| Front drop below shoulder line | 72 mm | REFERENCE_REQUIRED |
| Bound edge width | 6 mm | REFERENCE_REQUIRED |
| Neckline embroidery band | 12 mm | REFERENCE_REQUIRED |

## 4. Shaq (front slit) — VERIFIED (existence) / REFERENCE_REQUIRED (length)

A vertical slit at centre front running down from the neckline, edged with
embroidery on both sides. This is where the garment's main embroidery lives.

| Dimension | Value | Status |
|---|---|---|
| Length below neckline | 230 mm | REFERENCE_REQUIRED |
| Embroidery band width, **per side** | 18 mm | REFERENCE_REQUIRED |
| Slit opening width | 5 mm | REFERENCE_REQUIRED |

**This is the single most important correction in V2.** V1 rendered a 130 mm
band — over five times too wide — which is why the embroidery read as a
graphic ornament laid on top of the garment rather than thread sewn into it.

## 5. Furakha — VERIFIED (existence and position) / REFERENCE_REQUIRED (dimensions)

A thread tassel attached at the neckline and hanging down the chest. It is a
defining feature and must be visible at a believable scale.

| Dimension | Value | Status |
|---|---|---|
| Cord length | 90 / 150 / 210 mm (short / medium / long) | REFERENCE_REQUIRED |
| Cord thickness | 3.5 mm | REFERENCE_REQUIRED |
| Tassel head | 11 mm | REFERENCE_REQUIRED |
| Skirt (fringe) length | 34 mm | REFERENCE_REQUIRED |

It hangs under gravity: it stays vertical regardless of view angle and swings
slightly as the garment rotates.

## 6. Sleeves and cuffs — VERIFIED (loose, unstructured)

Set-in, generously cut, tapering gently to a soft opening. No stiff cuff, no
links, no button stand.

| Dimension | Value | Status |
|---|---|---|
| Sleeve drop angle at rest | 16° from vertical | REFERENCE_REQUIRED |
| Cuff finish depth | 22 mm | REFERENCE_REQUIRED |
| Cuff embroidery band | 14 mm (when the tailor offers it) | REFERENCE_REQUIRED |

## 7. Embroidery zones

| Zone | Typical | Status |
|---|---|---|
| `NECKLINE` | Yes — follows the bound edge | VERIFIED |
| `SHAQ` | Yes — the principal zone | VERIFIED |
| `CHEST` | Sometimes, flanking the shaq | REFERENCE_REQUIRED |
| `CUFF_LEFT` / `CUFF_RIGHT` | Tailor-dependent | REFERENCE_REQUIRED |
| `SHOULDER` | Uncommon | REFERENCE_REQUIRED |
| `BACK` | Uncommon on the Omani dishdasha | REFERENCE_REQUIRED |
| `FURAKHA_ACCENT` | Thread colour echoes the shaq | REFERENCE_REQUIRED |

A pattern declares which zones it may occupy. Nothing is placed in every zone
by default.

## 8. Embroidery physical scale — the V2 rule

Embroidery is specified in **millimetres**, never in screen pixels or as a
fraction of the garment. The renderer works in millimetre space, so a 22 mm
motif repeat is literally 22 units — the scale cannot silently drift.

| Property | Typical range | Status |
|---|---|---|
| Band width | 10–28 mm | REFERENCE_REQUIRED |
| Motif repeat interval | 14–30 mm | REFERENCE_REQUIRED |
| Stitch line weight | 0.5–1.1 mm | REFERENCE_REQUIRED |
| Thread density | 6–14 stitches / cm | REFERENCE_REQUIRED |

Enable `SHOW_PHYSICAL_EMBROIDERY_SCALE` in `src/visual/debug.ts` to overlay a
millimetre ruler over every embroidery band.

## 9. Fabric — VERIFIED (behaviour) / EXPERIMENTAL (simulation)

Fabric is a **material**, not a colour. The same ivory in a matte cotton and a
sateen must not render identically. Simulated via weave micro-structure,
directional sheen, drape folds and thickness at the edges.

Our simulation is **EXPERIMENTAL**: an approximation of textile response, not
measured material data. Real fabric photography replaces it through
`FabricScannerPipeline`.

## 10. Regional styles — REFERENCE_REQUIRED

Oman has legitimate regional variation in dishdasha construction. **We have no
verified reference data for it**, so `OMANI_DISHDASHA_STYLES` ships exactly one
entry, `om_standard`, marked `verified: true` only for the characteristics in
§1. Regional entries must not be invented; they are added when a tailor or a
documented source supplies the profile.

## 11. Originality

All demo embroidery is original geometric construction created for this
project. No tailor's proprietary pattern has been copied. References inform
scale, placement and density only — never the artwork itself.
