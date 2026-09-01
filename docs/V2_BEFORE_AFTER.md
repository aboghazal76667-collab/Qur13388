# V2 — before and after

Each entry: the V1 problem, what V2 does, how it is implemented, and what is still missing.

---

## 1. The garment did not look Omani

**V1** A generic robe with a rounded neck patch, flat shoulders and a decorative vertical line. Nothing distinguished it from any Gulf thobe.

**V2** A parametric silhouette built from a documented style profile: collarless neckline cut *into* the cloth, sloped shoulders (26 mm), A-line fall with the hem always wider than the chest, ankle length, loose sleeves with a soft cuff finish, and a real shaq.

**Implementation** `domain/omaniStyles.ts` + `visual/garmentGeometry.ts`. `docs/OMANI_VISUAL_STANDARD.md` records which characteristics are VERIFIED and which are REFERENCE_REQUIRED placeholders.

**Remaining** Every millimetre value is a plausible placeholder from our own measurement template, not a documented Omani tailoring spec. Needs a partner tailor.

---

## 2. Embroidery was 5× too large

**V1** The front band rendered **130 mm wide** with a **162 mm motif repeat** against a 1460 mm garment — graphic ornaments, not stitching. Root cause: embroidery was sized in screen units, and the band was sized around the artwork.

**V2** The renderer works in millimetres. The **zone** sets the band width (shaq 18 mm, neckline 12 mm, cuff 14 mm) and the motif is fitted into it — the inversion that let V1 run away. Motifs are authored in a 10 mm cell and drawn as thread: a shaded core stroke plus a finer highlight, so each line has the body of a real stitch.

**Implementation** `visual/units.ts`, `visual/embroideryScale.ts`, `v2/stitchMotifs.tsx`, `v2/EmbroideryBand.tsx`. `validatePhysical()` rejects impossible dimensions and is unit-tested. `SHOW_PHYSICAL_EMBROIDERY_SCALE` overlays a millimetre ruler.

**Remaining** The measured profiles for the 15 seeded patterns are our estimates. Real values arrive through `TailorEmbroideryImporter`, which refuses to publish a pattern without them.

---

## 3. Fabric was a hex colour

**V1** A flat fill. Ivory sateen and ivory cotton were the same rectangle.

**V2** Fabric and colour are separate concerns. A `FabricMaterial` carries weave, yarn pitch (0.3–1.0 mm), sheen, roughness, drape, thickness and opacity; the dye is shaded *by* the material. The shading ramp scales with dye lightness, so a navy shows its folds as highlights and an ivory as shadow instead of one flattening to black and the other blowing out.

**Implementation** `visual/materials.ts`, `v2/fabricRender.tsx`. Weave is drawn per family (plain / twill / sateen / slub / crepe / wool) at real yarn pitch, with drape folds and edge thickness.

**Remaining** EXPERIMENTAL — an approximation, not measured material data. `FabricScannerPipeline` defines the photography route; no computer vision is implemented.

---

## 4. No 360° view

**V1** One static front illustration.

**V2** Continuous horizontal rotation by drag, with front / side / back snapping. Every frame is the same geometry at a new camera angle, so the configuration cannot drift.

**Implementation** `v2/Dishdasha360Viewer.tsx` over the cross-section projection in `garmentGeometry.ts`.

**Verified** Shading ramp byte-identical at 0° / 90° / 180°; path count 98 → 25 → 17 as front features turn away. A snapping bug that sent a release near the front spinning to the back was caught by a unit test and fixed.

**Remaining** Not 3D. Horizontal only; no top or bottom view.

---

## 5. The furakha was an icon

**V1** A few pixels at the neckline, and it drew through the garment from every angle.

**V2** Built at real scale from the style profile (90 / 150 / 210 mm cords, 11 mm head, 34 mm skirt of individual uneven falls). It hangs under gravity — stays vertical whatever the camera does, swings slightly as the garment turns — and is **occluded once the front turns away**, because a chest tassel is not visible from behind.

**Implementation** `v2/Furakha.tsx`.

---

## 6. Zoom enlarged low-resolution graphics

**V1** A viewBox crop of the same flat drawing.

**V2** `GarmentDetailViewer` crops **millimetre space** and renders at HIGH quality, so zooming reveals more geometry — individual stitches, the weave, the bound neckline edge — rather than magnifying a picture. Regions are computed from the same live frame, so a detail can never show something the garment does not have.

---

## 7. The studio felt like CAD

**V1** Seven step chips, five zoom chips, a price, four utility actions and a primary action, all on screen at once.

**V2** One decision at a time. The garment takes ~60% of the screen and the stage follows the step — thread colours zoom to the shaq, furakha to the tassel, review hands over the rotatable garment. The bottom bar carries the price and exactly one primary action. Undo, reset, compare, kumma and the stylist live behind "خيارات أكثر". The step rail auto-scrolls the active step into view.

**Implementation** `app/(tabs)/design.tsx`, `features/studio/StepRail.tsx`, `features/studio/StudioStage.tsx`. `BUTTON_HEIGHT` standardises the button system.

**Preserved** Every V1 capability is still reachable. None was removed.

---

## 8. Fake scientific percentages

**V1** "94% مناسب لذوقك" — implying a measurement we do not have.

**V2** Words that describe the relationship to the customer's past choices: *مناسب جداً لذوقك*, *قريب من اختياراتك السابقة*, *اختيار جريء*, *اختيار كلاسيكي*, *اختيار جديد عليك*. A ranking score still exists internally; it is never rendered as a figure.

---

## 9. The stylist suggested colours, not garments

**V1** A palette. The customer still had to pick a fabric and a pattern.

**V2** Three **complete, orderable designs**: fabric, colour, pattern, every thread channel, furakha, total price, price difference against the current design, and whether the selected tailor can actually produce it. Producible designs rank first. Rejected colours are never suggested again.

**Implementation** `services/ai/stylistV2.ts`. The deterministic harmony engine is **preserved** and still generates the candidates.

---

## 10. Photorealistic preview sent a prompt

**V1** A mock behind an interface that would have taken a text prompt.

**V2** `PhotorealisticDishdashaProvider` accepts a `GarmentSpec` only — fabric material, exact hex, embroidery identity, **millimetre band width and repeat**, per-channel thread colours, furakha length, garment proportions, and the invariants a generator must not violate (collarless, ankle-length, has shaq). A prose prompt would throw all of that away, which is exactly how a model produces a different garment.

**Status** MOCK. `MockPhotorealisticProvider` returns a `simulated:` asset rendered by the vector engine and flagged `isSimulated`. `RemotePhotorealisticProvider` compiles but is **not connected to any vendor**.

---

## 11. Nothing checked what the AI returned

**V2** `DesignConsistencyValidator` compares generated output against the spec: base colour, thread colours, furakha presence, silhouette aspect, and a hard fail if a collar is detected. Poor confidence surfaces *"المعاينة تحتاج إعادة إنشاء"* with a retry rather than being presented as accurate. With no inspector it reports `unknown` — never a pass.

**Remaining** A real vision-based extractor does not exist. In mock mode the evidence comes from our own renderer, so it agrees by construction: this proves the wiring, not a model.

---

## 12. Try-on accepted a photo and did nothing useful

**V2** `VirtualTryOnService` takes the photo **and** the complete `GarmentSpec`. Consent and photo quality are enforced at the service boundary, so no screen can skip them. The flow adds framing guidance, a quality gate, and before/after. Framing only — no biometric or body-shape claim.

**Status** MOCK. Optional throughout; a photo is never required to order.

---

## 13. Tailor inventory was advisory

**V2** The stylist filters fabrics and patterns by what the selected tailor stocks and ranks producible designs first, showing *"غير متوفر لدى الخيّاط المختار"* otherwise.

**Remaining** Full per-tailor thread and furakha inventory is modelled but not yet populated.
