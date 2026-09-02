# Temporary real-3D prototype asset

Status: **active**. This asset is what the customer viewer renders today.

It is **not** the professional Omani dishdasha asset, it is **not**
production-ready, and it is **not** an authenticated Omani garment. It is a
technical stand-in that exists to prove the V3 pipeline end to end. When the
asset described in `docs/PROFESSIONAL_3D_ASSET_BRIEF.md` arrives, this one is
deleted.

Internal quality label: `TEMPORARY_REAL_3D_PROTOTYPE`.

---

## 1. What the file actually is

Read out of the GLB, not assumed:

| | |
|---|---|
| Generator | `trimesh` — a multi-view reconstruction, not a modelled garment |
| Scene | 2 nodes: `world` → `geometry_0` |
| Geometry | **one** primitive, 17,512 triangles, 11,291 vertices |
| Attributes | `POSITION`, `TEXCOORD_0`. **No normals**, no tangents |
| Material | one, unnamed, one baked 1024² baseColour texture |
| Bounds | 0.455 × 1.000 × 0.296 units, centred on the origin |
| File size | 1.47 MB |

It is a genuine Omani dishdasha silhouette: collarless, shaq slit, furakha
hanging at the front neckline, loose sleeves with cuff trim, A-line to the
ankle. Front faces +Z, verified by rendering all six canonical azimuths.

## 2. Two defects in the source file, and the repairs

Both are corrections for what the exporter omitted, recorded in
`PROTOTYPE_SOURCE_REPAIRS` so they read as deliberate rather than as magic
constants:

1. **No `NORMAL` attribute.** Without normals three.js renders the mesh
   unlit — a flat silhouette. `prepareMeshes()` calls
   `computeVertexNormals()` on any geometry that lacks them.
2. **No `metallicFactor`.** glTF's default is **1.0**, so the cloth loaded as
   fully metallic, fully rough — which with no environment map renders as dark
   grey metal. That was the first thing visible on screen: a grey garment when
   the baked texture is plainly off-white. Cotton is `metalness = 0`, and the
   repair sets that plus `roughness = 0.82` and a light sheen, per
   `docs/OMANI_MASTER_VISUAL_REFERENCE.md` §4.

A third adjustment is defensive rather than corrective: a reconstruction has
inconsistent winding in places, so the prototype renders double-sided. Without
it the garment shows holes at some angles.

## 3. Two normalisations

The mesh is authored 1.0 unit tall and centred on its bounding box, which is
not the contract. `normaliseModel()` fixes both:

- `scaleToMetres: 1.46` — one unit is one garment height, and the canonical
  Omani dishdasha is 1460 mm (`CANONICAL.totalLength`).
- `originPolicy: 'bounds_centre'` — the model is recentred on X/Z and lifted so
  the hem sits at y = 0. Without this the camera orbits the garment's waist and
  frames half of it.

A professional asset declares `originPolicy: 'hem'` and needs neither.

## 4. What it cannot do

The manifest validator records these as `info`-severity limitations rather
than silently tolerating them; the developer inspector lists all twelve.

- **No separated parts.** Sleeves, neckline, shaq, cuffs and the furakha are
  one fused mesh, so none can be addressed individually.
- **No design-driven materials.** `supportsDesignDrivenMaterials()` returns
  false, and every material setter on `Real3DRenderer` is a no-op for it.
  Changing fabric, base colour, embroidery pattern, thread channels or furakha
  colour does **not** change this render. Tinting a fused mesh would recolour
  the furakha and the cuff trim along with the cloth, which looks worse than
  leaving the asset as its author made it.
- **No embroidery surfaces.** The neckline and cuff trim visible on the mesh
  are painted into the baked texture. They are not the customer's chosen
  pattern and do not respond to it.
- **No furakha component.** It is baked in; it cannot be recoloured or
  resized.
- **Not measurement-driven.** It renders at canonical size.
- **Not visually accepted.** `visuallyAccepted: false`. The 22-check gate is
  about professional assets and this has not passed it.

Because the design does not drive the render, the V2 vector engine remains the
only place a customer sees their *actual* configured colours and embroidery —
on the millimetre detail views, and on every card and thumbnail.

## 5. What is enforced in code, not just documented

- `hasProfessionalAsset()` returns **false**. A prototype cannot move it.
- `customerReadyAsset()` returns **null** — it checks quality first, so no
  combination of `approvedForCustomers` and `visuallyAccepted` can push a
  prototype through that gate.
- The renderer reaches the prototype only through `renderableAsset()`, a
  separate and explicitly labelled door.
- `selectRenderer()` reports `reason: 'prototype_asset'`, never
  `'asset_available'` — that reason is reserved for a professional asset — and
  always carries `assetQuality` alongside `kind`.
- The same manifest declared `PROFESSIONAL` fails validation outright. The
  relaxation is scoped to the quality label and nothing else.

## 6. Replacing it

Exactly as designed in V3 — no application logic changes:

1. Drop the professional GLB into `dishdasha/assets/models/`.
2. Add its source id to `assetSource.ts`.
3. Register it in `GARMENT_ASSETS` with `quality: 'PROFESSIONAL'` and a
   complete manifest.
4. Run the 22-check acceptance gate; set `visuallyAccepted` only when it
   passes.
5. Delete the prototype entry and `prototypeManifest.ts`.

At step 3 the material path switches itself on: `supportsDesignDrivenMaterials`
becomes true, and fabric, colour, three independent thread channels and the
furakha start driving the render with no other change.

## 7. Cost

The GLB is inlined into the standalone web build, which grew from **3.38 MB to
5.26 MB**. That is the price of a page with zero external requests. On native
the file is bundled and read from disk.
