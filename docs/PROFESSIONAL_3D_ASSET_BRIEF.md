# Professional 3D asset brief — Omani dishdasha, master garment V1

**To:** garment 3D artist (Blender / CLO3D / Marvelous Designer)
**Deliverable:** one production GLB of an Omani dishdasha, plus textures and a
completed manifest
**Status of the receiving application:** the renderer is finished, live, and
currently driving a **temporary single-mesh prototype** so the pipeline could
be proved end to end (`docs/TEMPORARY_3D_PROTOTYPE.md`). That prototype has no
separated parts, so the customer's fabric, colour, thread and furakha choices
do not reach it. Delivering the asset below is what turns those choices back
on: registering it with `quality: 'PROFESSIONAL'` and a complete manifest
switches the design-driven material path on by itself, with no further
application work.

Read alongside:
- `docs/OMANI_MASTER_VISUAL_REFERENCE.md` — silhouette, proportion, material,
  embroidery scale, lighting, camera
- `docs/assets/OMANI_DISHDASHA_MASTER_REFERENCE.png` — the reference board
- `src/render/assetManifest.ts` — the machine-readable contract this brief
  describes in prose

---

## 1. What we are asking for, in one paragraph

A single, clean, production-quality mesh of a loose Omani dishdasha, hanging
as if worn — not laid flat, not on a visible mannequin — with separated
semantic parts, one fabric material slot, three embroidery material slots and
a separate furakha. We recolour the fabric, we swap the embroidery, we change
the furakha's colour and length, and we rotate it 360°. Nothing may be baked
in that we need to change.

## 2. The garment — non-negotiable characteristics

From `docs/OMANI_MASTER_VISUAL_REFERENCE.md` §2:

1. **Collarless.** A bound neckline edge. No stand collar, no fold-over
   collar, no shirt placket.
2. **Unstructured shoulder.** No pad, no hard seam ridge; a sloping shoulder
   line (~26 mm drop across the shoulder).
3. **A-line.** The hem is wider than the chest — approximately 1.14× — and
   never narrower.
4. **Full length**, hem at the ankle.
5. **Loose sleeve**, ~16° drop, tapering to a plain finished cuff.
6. **Shaq**: a front slit descending from the neckline, ~230 mm long, with a
   narrow finished band each side (~18 mm). It is a slit, not a button
   placket, and it does not run to the hem.
7. **Furakha**: a corded tassel hanging from the neckline at the front,
   modelled as separate geometry (§8).

If the reference board and real tailoring practice disagree, tailoring
practice wins — tell us and we will record the deviation.

## 3. Real-world scale and canonical dimensions

Model to real-world scale. Millimetres, from
`src/visual/garmentGeometry.ts` (`CANONICAL`):

| Dimension | mm |
|---|---|
| Total length (shoulder to hem) | 1460 |
| Shoulder width | 470 |
| Chest circumference | 1040 |
| Waist circumference | 980 |
| Hem sweep (circumference) | 1300 |
| Sleeve length (shoulder to cuff) | 620 |
| Neck opening circumference | 410 |
| Cuff opening circumference | 240 |
| Shaq length | 230 |
| Shaq band width, per side | 18 |
| Neckline front drop | 72 |
| Neckline back drop | 26 |

Cross-section depth ratios (depth ÷ width at that height), which give the
garment its volume in a turn: shoulder 0.38, chest 0.58, waist 0.72, hem 0.92.
The garment must be **shallow at the shoulders and nearly circular at the
hem** — this is what makes rotation read correctly.

These values are marked REFERENCE_REQUIRED in our own documentation. If your
tailoring experience says a number is wrong, say so before you model.

## 4. Origin, orientation, units

- **Units:** metres in the export (`units: 'm'`, `scaleToMetres: 1`). Model
  at 1 unit = 1 m; the 1460 mm garment is 1.46 units tall.
- **Up axis:** +Y.
- **Facing:** the garment front faces **+Z**.
- **Origin:** world origin at the **centre of the hem plane** — X and Z
  centred on the garment, Y = 0 at the hem. The shoulder line then sits at
  Y ≈ 1.46. This lets the application frame and orbit without hunting for a
  bounding box centre.
- **Transforms applied.** No unapplied scale, rotation or location on any
  node. No negative scale.
- Symmetric geometry may be mirrored while modelling but must be **applied**
  before export; left and right must be separate, real nodes.

## 5. Topology

- **Quads while modelling**, triangulated on export.
- **Even, garment-appropriate density.** Denser through the shoulder, chest,
  neckline and cuffs where silhouette and detail read; sparser through the
  lower skirt.
- **No n-gons, no non-manifold edges, no interior faces, no duplicate
  vertices, no zero-area faces.**
- **Consistent outward normals.** The garment is closed enough to read as
  cloth from any of the four canonical angles; we do not render backfaces.
- **Real thickness at visible edges** — neckline, shaq, cuffs, hem. A
  zero-thickness edge is the tell that gives away a game asset at detail zoom.
- **Folds modelled, not textured.** A small number of soft, wide vertical
  folds, consistent with mid-weight cotton. Do not model many sharp creases.
- **Smooth shading** with an edge-split or weighted-normal setup at genuine
  hard edges only (cuff finish, hem edge, shaq band).

## 6. Polygon budget

| | Triangles |
|---|---|
| Target | **90,000** |
| Hard ceiling | **150,000** |

Our manifest validator emits a warning above 150k
(`validateManifest()`), and `resolveTier()` drops a device to a lower
quality tier above 120k. Staying near 90k keeps mid-range Android phones at a
smooth 360° drag.

## 7. Node structure and naming

Names are the contract. Our `AssetManifest` maps your names onto our semantic
zones, so they must be exact and stable. Reference names — use these unless
you tell us otherwise:

**Garment body (all required):**

| Our zone | Node name |
|---|---|
| `body` | `Dishdasha_Body` |
| `leftSleeve` | `Dishdasha_Sleeve_L` |
| `rightSleeve` | `Dishdasha_Sleeve_R` |
| `neckline` | `Dishdasha_Neckline` |
| `shaq` | `Dishdasha_Shaq` |
| `leftCuff` | `Dishdasha_Cuff_L` |
| `rightCuff` | `Dishdasha_Cuff_R` |

**Optional, only if you model them:** `Dishdasha_Pocket`,
`Dishdasha_Shoulder_Detail`, `Dishdasha_Back_Detail`.

**Embroidery surfaces** (separate geometry — see §9):

| Our surface | Node name |
|---|---|
| `necklineEmbroidery` | `Emb_Neckline` |
| `shaqLeftEmbroidery` | `Emb_Shaq_L` |
| `shaqRightEmbroidery` | `Emb_Shaq_R` |
| `leftCuffEmbroidery` | `Emb_Cuff_L` |
| `rightCuffEmbroidery` | `Emb_Cuff_R` |
| `optionalBackEmbroidery` | `Emb_Back` (optional) |

At minimum **one shaq embroidery surface must exist**; the validator rejects
an asset without it, because the shaq carries the principal Omani embroidery.

**Furakha (all required, separate geometry):**

| Our zone | Node name |
|---|---|
| `cord` | `Furakha_Cord` |
| `head` | `Furakha_Head` |
| `tassel` | `Furakha_Tassel` |

No spaces, no `.001` suffixes, no localisation in node names. Everything
Arabic-facing happens in our application, never in your file.

## 8. The furakha — a hard requirement

The furakha is a **separate, independently transformable component**. It must
never be baked into the body mesh or painted into the body texture. Our
validator raises an error, not a warning, if any furakha node is missing —
"furakha must be separate geometry, not baked into the body".

- Cord thickness ≈ 3.5 mm; tassel head radius ≈ 11 mm; skirt length ≈ 34 mm.
- Attachment point at the neckline front, ≈ 0.92 of the way down the neckline
  drop.
- Model at the **medium** cord length, **150 mm**. We drive short (90 mm) and
  long (210 mm) by scaling `Furakha_Cord` along its length; keep its origin at
  the attachment point and its local axis along the cord so that scaling works.
- The furakha has its own material slot and is recoloured independently of
  both fabric and embroidery.

## 9. Embroidery zones — geometry, not texture

Embroidery is customer-configurable: a pattern from our library, rendered
across up to **three independent thread colour channels**, any of which may be
metallic. Therefore:

- Each embroidery surface is **its own geometry**, offset ~0.6–1.0 mm above
  the fabric surface, following it exactly (no floating, no z-fighting).
- Surfaces are **flat bands** in the shapes and widths below. Do **not** model
  a specific motif and do **not** paint one into a texture — we drive the
  motif through the material.
- Band widths (mm), from `ZONE_BAND_WIDTH`:
  neckline 12 · shaq 18 (per side) · chest 10 · cuff 14 (each) ·
  shoulder 10 · back 16 · furakha accent 6.
- Each band needs a **clean, continuous, non-overlapping UV strip** on the
  embroidery UV set (§11), running *along* the band, so a motif repeats along
  its length without stretching or seaming mid-motif.
- Bands must be assigned to the embroidery material slots, split so that
  channel separation is possible: at minimum `MAT_Emb_Ch1` and `MAT_Emb_Ch2`
  are used by different bands (see §10).

Under no circumstances bake embroidery into the fabric texture. A baked motif
makes the customer's choice unrepresentable.

## 10. Material slots

Exactly four names, no more:

| Slot | Drives |
|---|---|
| `MAT_Fabric` | The dishdasha cloth. We set base colour, roughness, sheen and sheen tint at runtime |
| `MAT_Emb_Ch1` | Embroidery thread channel 1 |
| `MAT_Emb_Ch2` | Embroidery thread channel 2 |
| `MAT_Emb_Ch3` | Embroidery thread channel 3 |
| `MAT_Furakha` | Furakha cord, head and tassel |

Rules:

- Author `MAT_Fabric` as a **neutral off-white** (≈ `#F2EDE3`). We recolour it;
  a strongly tinted authored colour fights our dye values.
- Do **not** bake lighting, ambient occlusion shadowing, or colour grading into
  base colour. AO belongs in the AO map (§12).
- Thread materials are authored neutral too. We set colour and metallic per
  channel independently — channel 3 may be metallic gold while channels 1 and
  2 are matte navy, in the same design.
- No emissive, no transmission, no clearcoat on the fabric.

## 11. UVs

Two UV sets, named exactly:

| Set | Name | Purpose |
|---|---|---|
| 1 | `UVMap` | Fabric weave. Tileable, uniform texel density, oriented so the weave runs with the garment's grain — vertical on the body, along the arm on the sleeves |
| 2 | `UVEmbroidery` | Embroidery bands. Each band a clean strip, motif direction along the band's length |

- **Uniform texel density** on `UVMap`; a sleeve must not show a coarser weave
  than the chest.
- **Seams in tailoring seams** — side seams, underarm, shoulder — never across
  the chest or the front of the skirt.
- No overlapping islands on `UVMap` (the AO bake needs them separate).
- Consistent island orientation; no mirrored islands on the fabric set.

## 12. Textures and PBR maps

Deliver at **2048×2048**, PNG or KTX2. We downsample to 1024 and 512 for the
BALANCED and LOW tiers.

| Map | Required | Notes |
|---|---|---|
| Base colour | Yes | Neutral off-white, no baked lighting |
| Normal | Yes | Tangent space, OpenGL green channel. The weave lives here |
| Roughness | Yes | Cotton: 0.6–0.85. Not uniform — folds and worn edges vary |
| Ambient occlusion | Yes | Baked from the mesh only. Contact darkening at the neckline, underarm, fold interiors |
| Metalness | No | Fabric is 0. Thread metalness is set at runtime |
| Sheen / sheen roughness | Optional | If supplied, sheen tint must be fabric-coloured, not white |

The fabric must read as **matte cotton with a low broad sheen** — never satin,
never plastic. At full-length framing the weave must not read as noise; it
should only become visible at detail zoom.

## 13. Export — GLB requirements

- **Format:** binary glTF 2.0, `.glb`, single file, textures embedded.
- **Compression:** Draco on geometry is welcome; KTX2/Basis on textures is
  welcome. Send an uncompressed copy as well so we can compare.
- **Size target:** ≤ 12 MB total. Hard ceiling 25 MB — this loads on a mobile
  connection.
- **Include:** node names exactly as §7, both UV sets, material slots as §10,
  tangents.
- **Exclude:** cameras, lights, animations, armatures, physics/cloth
  modifiers (apply them), hidden helper objects, mannequin geometry, ground
  planes, any node not named in §7.
- **No node hierarchy tricks:** a flat, readable scene graph.
- Verify the export opens correctly in a neutral viewer (glTF Validator or
  `https://gltf-viewer.donmccurdy.com`) with zero errors before sending.

## 14. Optional: morph targets for measurements

Optional, and genuinely optional — the asset is accepted without them.

If you supply them, name them: `garmentLength`, `shoulderWidth`, `chestEase`,
`sleeveLength`, `sleeveOpening`, `bodyWidth`, `hemWidth`, `neckOpening`. Each
should run 0 → 1 across a plausible tailoring range and must not distort the
embroidery UVs.

We deliberately do **not** deform the mesh procedurally: procedural deformation
destroys embroidery UVs and cloth quality. Without morph targets the garment
renders at canonical size and the customer's measurements are still recorded,
priced and printed on the tailor's ticket — we simply do not claim the render
is dimensionally personalised.

## 15. LOD

Optional but valuable. If supplied: `LOD0` at full budget, `LOD1` at ~50%,
`LOD2` at ~25%, same node names suffixed `_LOD1` / `_LOD2`, same materials and
UVs. Silhouette must survive reduction — reduce the skirt interior, not the
neckline or the cuffs.

## 16. Acceptance — how we will judge it

The application will not show the asset to a customer until all of the
following hold. `evaluateAcceptance()` in `src/render/visualAcceptance.ts`
treats an unanswered check as **not passed**.

**Machine checks** (`validateManifest()`, run automatically):

1. Contract version matches.
2. All seven required garment zones bound.
3. All three furakha zones bound as separate geometry.
4. At least one shaq embroidery surface bound.
5. Fabric material slot present; at least one embroidery slot present.
6. Positive scale to metres; Y-up.
7. Triangle count within budget.

**Visual acceptance** (22 blocking checks, reviewed by us against
`docs/OMANI_MASTER_VISUAL_REFERENCE.md`), including: collarless neckline;
unstructured shoulder; A-line hem wider than chest; correct shaq length and
band width; furakha separate and correctly attached; embroidery reading as
thread at correct physical width; matte cotton response under the studio rig;
no z-fighting at any canonical angle; silhouette correct at 0°, 45°, 90° and
180°; no visible seam or UV stretch at detail zoom.

### Screenshots to deliver with the asset

Rendered in a neutral viewer, no post-processing, on a warm neutral ground:

| # | View | Purpose |
|---|---|---|
| 1 | Front, full length | Silhouette, proportion |
| 2 | Front 45°, full length | Volume in the turn |
| 3 | Side, full length | Depth ratios, sleeve drop |
| 4 | Back, full length | Yoke, back silhouette |
| 5 | Neckline + chest, detail | Bound edge, furakha attachment, embroidery band |
| 6 | Shaq, detail | Slit, band width, edge thickness |
| 7 | Cuff, detail | Taper, finish, edge thickness |
| 8 | Furakha, detail | Cord, head, tassel as separate geometry |
| 9 | Fabric surface, detail | Weave scale and sheen |
| 10 | Wireframe, front | Topology and density distribution |
| 11 | UV layout, both sets | Island layout, texel density |

## 17. Versioning and replacement

- The asset carries an `assetVersion` — `master-v1` for this delivery.
- Replacing it is a new GLB plus a new manifest entry, never an application
  change. `assetId` changes; the old asset can stay registered and unapproved
  for comparison.
- A revision that changes node names or material slots is a **new asset**, not
  an update, because the manifest binding changes.
- If our contract version increments, we will send you the diff; existing
  assets keep working until we retire the old version explicitly.

## 18. What we will do on our side when it arrives

1. Fill in an `AssetManifest` with your node names and triangle count.
2. Run `validateManifest()` — machine checks in §16.
3. Register the asset in `src/render/assetRegistry.ts`.
4. Run the 22-check visual acceptance gate against the reference.
5. Only when all of that passes do we set `visuallyAccepted: true`, at which
   point `selectRenderer()` starts returning the real 3D renderer and
   customers see a real garment.

Until then, every customer sees the V2 vector fallback, and we say so.

## 19. Questions we expect, answered in advance

**Can I model it on a body?** Model it hanging as worn, but export the garment
only. No mannequin, no body mesh.

**Can I use CLO3D / Marvelous Designer simulation?** Yes, and preferably.
Simulate, then retopologise to the budget in §6, apply the simulation, and
transfer detail into the normal map.

**Can I bake the embroidery — it would look better?** No. See §9. The customer
chooses the pattern and up to three thread colours; a baked motif makes their
choice unrepresentable, which is the single thing this whole architecture
exists to prevent.

**What if the reference image shows something I know is wrong?** Tell us.
Tailoring practice wins over the reference board, and we will record the
deviation in `docs/OMANI_MASTER_VISUAL_REFERENCE.md` §9.
