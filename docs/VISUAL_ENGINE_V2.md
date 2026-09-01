# DishdashaVisualEngineV2

## The decision: parametric 2.5D, not 3D

**We did not implement true 3D, and the app never claims to.**

Three options were on the table for the 360° viewer:

| | Real-time 3D mesh | Pre-rendered multi-angle assets | **Parametric 2.5D (chosen)** |
|---|---|---|---|
| Expo Go compatible | No — needs `expo-gl` + three.js, a custom dev build in practice | Yes | **Yes** |
| Download size | 3–15 MB per garment | ~200 KB × angles × colourways | **0 KB — it is code** |
| Change fabric colour live | Yes | No — one bake per colourway | **Yes** |
| Change embroidery live | Yes | No — combinatorial explosion | **Yes** |
| Rotation | Continuous | Stepped between baked frames | **Continuous** |
| iPhone performance | Heavy | Light | **Light — vector paths** |
| Risk | Native dependency, breaks Expo Go | Asset pipeline we do not have yet | **Low** |

Pre-rendered assets were disqualified by the product itself: with ~28 colours × 12 fabrics × 15 patterns × 3 thread channels, there is no set of baked images that covers what the configurator already lets a customer build. Real-time 3D was disqualified for this sprint by the Expo Go constraint, and faking 3D was explicitly out of scope.

### What parametric 2.5D actually is

The garment is a stack of **elliptical cross-sections** — wide and shallow at the shoulders (depth ≈ 0.38 × width), nearly circular at the hem (0.92). A point on a cross-section at angle `phi` (0 = centre front) projects to screen x as:

```
x = W·sin(phi)·cos(theta) + D·cos(phi)·sin(theta)
```

for semi-width `W`, semi-depth `D` and camera angle `theta`. From that one formula come:

- the **silhouette edge**: `sqrt((W·cos θ)² + (D·sin θ)²)`
- the **travel of the centre-front line** as the garment turns
- **which features face the camera**, via the surface normal — so the shaq slides round the body, embroidery foreshortens instead of vanishing, and the far sleeve is drawn first

It is a real projection of a real solid of revolution. It is **not** a mesh: there is no depth buffer, no lighting model, no self-shadowing, and no view of the garment from above or below. Rotation is horizontal only.

**Verified:** the shading ramp is byte-identical at 0° / 90° / 180°, and the rendered path count falls 98 → 25 → 17 as front-facing features correctly turn away rather than drawing through the garment.

### The seam for a future 3D provider

`Dishdasha360Viewer` takes a config, a measurement profile and an angle, and owns the gesture. Swapping its renderer for a GL-backed one is a change inside that component; the studio, review and compare screens do not move.

## Millimetre space

The renderer's coordinate system **is millimetres**. `CANVAS` is 1120 × 1700 mm; an 18 mm embroidery band is the number 18.

This is the structural fix for V1's central failure. V1 sized embroidery in screen units, and the front band rendered **130 mm wide against a 1460 mm garment** — over five times life size, with a 162 mm motif repeat. That is why it read as a graphic ornament laid over the garment rather than thread sewn into it. In V2 a wrong value is a visibly wrong number in the source, and `validatePhysical()` rejects anything outside manufacturable limits.

## Layers

| Layer | Module | Independently changeable |
|---|---|---|
| Garment geometry | `visual/garmentGeometry.ts` | Measurements + Omani style profile |
| Fabric material | `visual/materials.ts` | Weave, drape, sheen, roughness, thickness |
| Fabric colour | `data/colors.ts` | Dye, shaded *by* the material |
| Embroidery | `v2/EmbroideryBand.tsx` | Per zone, at physical scale |
| Thread colours | `visual/materials.ts` | Three independent channels |
| Furakha | `v2/Furakha.tsx` | Hangs under gravity |
| Lighting | engine gradients | One key direction, constant at every angle |
| Camera | `angle` prop | Continuous |

## Quality modes

`resolveQuality()` is pure and unit-tested — no react-native import — so the platform lookup belongs to the caller. AUTO picks from rendered size and pixel density: below 120 pt LIGHT, below 260 pt BALANCED, otherwise HIGH; detail views are always HIGH. Quality changes how much micro-detail is drawn and **never** the geometry, colour or embroidery placement, so a LIGHT render is the same garment, plainer.

The weave is skipped entirely when a yarn would be thinner than a pixel — invisible detail that still costs a path each.

## Honest limitations

- **Not 3D.** No mesh, no real lighting, no top/bottom view. Horizontal rotation only.
- **Fabric simulation is EXPERIMENTAL** — chosen constants that read convincingly, not measured material data.
- **Millimetre values are REFERENCE_REQUIRED** placeholders from our own measurement template, not a documented Omani tailoring spec.
- **One style only.** Regional Omani variants are modelled but not shipped, because we have no verified reference data and will not invent it.
- Embroidery is **original geometric artwork**, informed by scale and placement conventions only.
