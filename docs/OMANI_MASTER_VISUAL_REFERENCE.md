# Omani dishdasha — master visual reference

Reference sheet: `docs/assets/OMANI_DISHDASHA_MASTER_REFERENCE.png`

The sheet is a studio product board: one white Omani dishdasha shot front,
front-45°, side and back, plus detail crops of the neckline and chest, the
cuffs, the shoulder, the back, the furakha, the fabric surface and the
embroidery.

**How this document is meant to be used.** "Match the attached image" is not
an engineering instruction — it cannot be reviewed, tested, or handed to an
artist. What follows converts the sheet into explicit rules: what it is
authoritative about, what it is only indicative of, and the numeric targets
the renderer and the asset must hit.

---

## 1. Authority of the reference — read this first

The image is a *presentation and proportion* reference. It is an image; parts
of it are incidental.

**The sheet IS authoritative for:**

| Dimension | What it fixes |
|---|---|
| Silhouette | Loose, collarless, straight-shouldered, gently A-line, floor-length |
| Proportion | Length-to-shoulder ratio, sleeve drop, hem sweep, shaq length relative to body |
| Material feel | Matte cotton with a soft sheen; drape that breaks into few, wide folds |
| Embroidery scale | Thread that reads as *stitching*, narrow relative to the chest — never a printed graphic |
| Presentation quality | Clean studio board, garment isolated, no props, no styling clutter |
| Lighting | Soft key from the front-left, gentle fill, faint rim, soft contact shadow |
| Camera direction | Long lens, no wide-angle bow, garment near-centred and filling the frame |

**The sheet is NOT authoritative for:**

- Any specific decorative motif shape. The embroidery in the sheet is
  incidental to the photograph, not an Omani standard, and it is not the
  pattern library. Our patterns come from `src/data/embroidery.ts`.
- Exact millimetre dimensions. Nothing was measured; every number below is
  marked accordingly.
- The furakha's exact braid construction or tassel shape.
- Colour values. The sheet is one white garment under one lighting setup; our
  colour catalogue is 40+ dyes.
- Regional style. The sheet does not identify a region, so we do not infer
  one. `OMANI_DISHDASHA_STYLES` still contains exactly one entry.

**Explicit rule for the 3D artist and for us:** do not blindly reproduce
accidental AI-generated details. Where the sheet shows something that
tailoring practice does not support, tailoring practice wins and the
deviation is recorded in §9.

## 2. Silhouette rules

1. **Collarless.** No stand collar, no fold-over collar, no placket band that
   reads as a shirt. The neckline is a bound edge.
2. **Unstructured shoulder.** No shoulder pad, no sharp seam ridge. The
   shoulder line slopes; `SHOULDER_SLOPE = 26 mm` in
   `src/visual/garmentGeometry.ts`.
3. **A-line, not a tube and not a flare.** The hem is wider than the chest and
   never narrower: `aLineRatio = 1.14`, enforced by `Math.max()` in
   `buildFrame()`.
4. **Full length.** The hem falls at the ankle. Canonical `totalLength = 1460 mm`.
5. **Loose sleeve, tapering to a plain cuff.** `dropAngle = 16°`,
   `upperWidth = 230 mm`, `taper = 0.52`.
6. **Continuous front.** The shaq is a slit from the neckline, not a button
   placket. `shaqProfile.length = 230 mm`.
7. **The furakha hangs from the neckline**, at the front, and is a separate
   component — never a printed detail on the body.

## 3. Proportions — canonical values

Source of truth: `CANONICAL` in `src/visual/garmentGeometry.ts`. All values
millimetres. Every one of these is **REFERENCE_REQUIRED** — plausible
tailoring numbers, consistent with the sheet's proportions, awaiting
confirmation from a partner tailor.

| Dimension | Value | Ratio to length |
|---|---|---|
| Total length | 1460 | 1.00 |
| Shoulder width | 470 | 0.32 |
| Chest circumference | 1040 | — |
| Waist circumference | 980 | — |
| Hem sweep | 1300 | 0.89 |
| Sleeve length | 620 | 0.42 |
| Neck circumference | 410 | — |
| Cuff circumference | 240 | — |
| Shaq length | 230 | 0.16 |
| Neckline front drop | 72 | 0.049 |

Vertical landmarks are derived, not authored separately: armhole at 0.20 of
length, chest at 0.22, waist at 0.42. Cross-section depth ratios —
shoulder 0.38, chest 0.58, waist 0.72, hem 0.92 — encode that a loose robe is
shallow at the shoulder and nearly circular at the hem. These are what make a
turn read as a garment turning rather than an image sliding.

## 4. Material feel

From the fabric crop, and the way light falls across the body panels:

- **Matte with a low, broad sheen.** Not satin, not shiny. In PBR terms:
  high roughness (0.6–0.85), zero metalness, a modest sheen term with a
  *fabric-coloured* sheen tint, not white.
- **Weave visible at detail range only.** At full-length framing the weave
  must not read as noise or as a tiled texture.
- **Few, wide folds.** Cotton of this weight breaks into a small number of
  soft vertical folds; it does not crease into many sharp ones.
- **The colour is dye in cloth, not a UI fill.** Shading ramps scale with the
  dye's lightness (`src/visual/materials.ts`) so a midnight navy and an
  off-white are shaded differently, as they physically are.

## 5. Embroidery scale — the rule the sheet confirms

In the sheet, chest embroidery is a *narrow* band against a wide chest. It
reads as thread. This is the single most important corrective the reference
provides, and V2 already encodes it structurally.

| Zone | Band width (mm) |
|---|---|
| Neckline | 12 |
| Shaq | 18 |
| Chest | 10 |
| Cuff (each) | 14 |
| Shoulder | 10 |
| Back | 16 |
| Furakha accent | 6 |

Motif repeat: 8–46 mm. Density: 4–18 stitches/cm. Stitch weight:
0.35–1.6 mm. Enforced by `validatePhysical()` in
`src/visual/embroideryScale.ts`; out-of-range values are a data error, not a
style choice.

Status: **REFERENCE_REQUIRED**. These are plausible manufacturing values that
match the sheet's proportions; they are not measured from a physical garment.
`SHOW_PHYSICAL_EMBROIDERY_SCALE` renders the numbers on screen for review.

The historical failure this prevents: V1 drew a 130 mm shaq band on a 1460 mm
garment — over five times life size — which is precisely why it read as a
graphic ornament laid on top of a garment.

## 6. Presentation and framing

- **Garment occupies 60–70% of the visual area.** `frameGarment()` in
  `Real3DRenderer` computes the orbit radius to hit ~65% of frame height.
- **Warm neutral studio ground.** Not white, not grey-blue, not a gradient
  that competes with the garment.
- **Nothing else in frame.** No mannequin head, no hanger, no props, no
  watermark.
- **No debug UI in customer mode.** Scale overlays, wireframes, zone labels
  and renderer diagnostics live behind `DEV_VISUAL_INSPECTOR`
  (`app/dev/visual-inspector.tsx`).
- **Slight downward tilt** on full-length views: `elevation = 4°`. Looking up
  at a hem is never flattering; elevation is clamped to −8°…+22°.

## 7. Camera

Long lens throughout. A wide-angle lens bows the hem outward and makes the
garment read as a game asset.

| Preset | Azimuth | Elevation | FOV | Zoom |
|---|---|---|---|---|
| FRONT | 0° | 4° | 26° | 1.0 |
| FRONT_45 | 45° | 4° | 26° | 1.0 |
| SIDE | 90° | 4° | 26° | 1.0 |
| BACK | 180° | 4° | 26° | 1.0 |
| DETAIL_NECK | 0° | 8° | 30° | 4.2 |
| DETAIL_SHAQ | 0° | 2° | 30° | 3.6 |
| DETAIL_CUFF | 22° | −2° | 30° | 4.6 |
| DETAIL_FURAKHA | 0° | 2° | 30° | 4.8 |

The four full-length presets are exactly the four views on the reference
sheet, which is why they are also the four buttons a customer sees.

## 8. Lighting

`STUDIO_RIG` in `src/render/lighting.ts`, matching the sheet's read:

- **Key**, front-left and above — the only light that casts a shadow.
- **Fill**, opposite and lower, weak; it opens the shadow side without
  flattening the folds.
- **Rim**, behind, narrow; it separates the garment from the ground.
- **Ambient**, very low, warm.
- ACESFilmic tone mapping, with exposure driven by the dye's lightness
  (`exposureFor()`), so a dark garment is not crushed and a white one is not
  blown out.

## 9. Deviations from the sheet, and why

| Sheet shows | We do | Reason |
|---|---|---|
| One specific embroidery motif | Our own pattern library | The sheet's motif is incidental to the photograph; our patterns are original and catalogued |
| One white garment | 40+ catalogue dyes | The sheet is a lighting/proportion reference, not a colour reference |
| Unmeasured proportions | Explicit millimetre values, all marked REFERENCE_REQUIRED | An unverified number that is *visible* can be corrected; an implicit one cannot |
| A particular furakha braid | Parametric cord/head/tassel, three lengths | Length is a customer choice; the sheet shows one instance |
| No region stated | One style only (`om_standard`) | We do not infer a regional variant from a photograph |

## 10. How this document is enforced

- `src/render/visualAcceptance.ts` — 22 blocking checks derived from §2–§8.
  `evaluateAcceptance()` treats an unanswered check as **not passed**.
- `src/visual/embroideryScale.ts` — §5 limits, machine-checked.
- `src/render/cameraPresets.ts` — §7 verbatim.
- `src/render/lighting.ts` — §8.
- `docs/PROFESSIONAL_3D_ASSET_BRIEF.md` — §2, §3 and §5 restated as
  deliverables for the garment artist.

Nothing in this document may be satisfied by drawing. It describes a physical
garment and how it is photographed.
