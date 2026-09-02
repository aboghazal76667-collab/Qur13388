/**
 * Real3DRenderer — three.js.
 *
 * A REAL renderer: one mesh, one scene, a real perspective camera, real lights
 * and real PBR materials. Rotation moves the camera around the same geometry;
 * it does not swap pictures.
 *
 * =====================================================================
 * WHAT IT IS RENDERING TODAY is a TEMPORARY_REAL_3D_PROTOTYPE: a real
 * single-mesh GLB, not a professional garment asset. It is genuinely one
 * mesh orbited by one camera — that part is real — but the asset itself
 * is a technical stand-in. "The pipeline is real" is NOT the same claim
 * as "the garment is production quality".
 *
 * A prototype has no separated parts and one baked texture, so the
 * design-driven material path is switched OFF for it (see
 * `supportsDesignDrivenMaterials`): tinting a fused mesh would recolour the
 * furakha and the trim along with the cloth, which is worse than leaving
 * the asset as authored.
 * =====================================================================
 *
 * three.js was chosen over react-three-fiber deliberately: this contract is
 * imperative (loadGarment / setFabricColor / rotate), a GL scene graph is
 * long-lived, and rebuilding it from React props on every colour tap would be
 * both slower and harder to reason about. See docs/REAL_3D_RENDERER_DECISION.md.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { getPattern } from '@dd/data/embroidery';
import { materialFor, threadMaterial } from '@dd/visual/materials';
import { hexToHsl } from '@dd/engine/color';
import type { FabricTexture } from '@dd/domain/types';
import type { GarmentSpec } from '@dd/services/ai/photorealistic';
import type { AssetManifest, EmbroiderySurfaceId, GarmentZoneId } from '../assetManifest';
import { manifestIsUsable, supportsDesignDrivenMaterials, validateManifest } from '../assetManifest';
import { PROTOTYPE_SOURCE_REPAIRS } from '../prototypeManifest';
import { resolveAssetUri } from '../assetSource';
import { CAMERA_PRESETS, clampElevation, clampZoom, type CameraPresetId } from '../cameraPresets';
import { STUDIO_RIG, TONE_MAPPING, exposureFor } from '../lighting';
import { fabricToPbr, recolour, threadToPbr, type Pbr } from '../materials3d';
import { computePlacements } from '../embroideryPlacement';
import { TIER_SETTINGS, type RenderTier } from '../quality3d';
import type {
  GarmentRenderer,
  LoadResult,
  RendererCapabilities,
  ViewState,
} from '../types';

/** Anything three.js needs to draw into, on web or on native via expo-gl. */
export type GLContextLike = {
  drawingBufferWidth: number;
  drawingBufferHeight: number;
  canvas?: unknown;
  /** expo-gl signals frame completion through this. */
  endFrameEXP?: () => void;
};

export type Real3DOptions = {
  gl: GLContextLike;
  width: number;
  height: number;
  pixelRatio: number;
  tier: RenderTier;
  onFrame?: () => void;
  /**
   * Called whenever the scene changes and needs redrawing.
   *
   * The renderer draws ON DEMAND, not in a permanent loop. A garment that is
   * not moving is a still image: re-rendering it sixty times a second burns
   * battery on a phone and, on a slower GPU, starves the main thread badly
   * enough that ordinary taps elsewhere in the app stop landing.
   */
  onInvalidate?: () => void;
};

export class Real3DRenderer implements GarmentRenderer {
  readonly kind = 'real3d' as const;

  readonly capabilities: RendererCapabilities = {
    trueMesh: true,
    continuousRotation: true,
    pinchZoom: true,
    capturePreview: true,
    perMaterialTextures: true,
    realLighting: true,
  };

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private root = new THREE.Group();
  private manifest: AssetManifest | null = null;
  private tier: RenderTier;

  /** Resolved application zone → the three.js object that realises it. */
  private zoneObjects = new Map<GarmentZoneId, THREE.Object3D>();
  private embroideryObjects = new Map<EmbroiderySurfaceId, THREE.Object3D>();
  private furakhaGroup: THREE.Group | null = null;

  private fabricMaterial: THREE.MeshPhysicalMaterial | null = null;
  /** One material per thread channel, so channels stay independent. */
  private threadMaterials = new Map<1 | 2 | 3, THREE.MeshPhysicalMaterial>();

  /**
   * False for a prototype: the app keeps the asset's authored materials and
   * does not drive colour, weave, thread or furakha from the design.
   */
  private designDrivenMaterials = false;

  private view: ViewState = { azimuth: 0, elevation: 4, zoom: 1 };
  /** Set by every mutation; the surface turns it into exactly one redraw. */
  private needsRender = true;
  private target = new THREE.Vector3(0, 0.85, 0);
  private radius = 3.4;
  private disposed = false;

  constructor(private readonly options: Real3DOptions) {
    this.tier = options.tier;
    const settings = TIER_SETTINGS[this.tier];

    this.renderer = new THREE.WebGLRenderer({
      // expo-gl hands us a context; on web three creates its own canvas.
      context: options.gl as unknown as WebGLRenderingContext,
      canvas: options.gl.canvas as HTMLCanvasElement | undefined,
      antialias: settings.antialias,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(options.pixelRatio, settings.maxPixelRatio));
    this.renderer.setSize(options.width, options.height, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = TONE_MAPPING.baseExposure;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = settings.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(
      CAMERA_PRESETS.FRONT.fov,
      options.width / Math.max(1, options.height),
      0.05,
      50,
    );

    this.scene.add(this.root);
    this.buildLighting();
    this.updateCamera();
  }

  // ── lighting ────────────────────────────────────────────────────────────
  private buildLighting() {
    const settings = TIER_SETTINGS[this.tier];
    for (const spec of STUDIO_RIG) {
      if (spec.kind === 'ambient') {
        this.scene.add(new THREE.AmbientLight(new THREE.Color(spec.color), spec.intensity));
        continue;
      }
      const light = new THREE.DirectionalLight(new THREE.Color(spec.color), spec.intensity);
      light.position.set(spec.position!.x, spec.position!.y, spec.position!.z);
      if (spec.castShadow && settings.shadows) {
        light.castShadow = true;
        light.shadow.mapSize.set(settings.shadowMapSize, settings.shadowMapSize);
        light.shadow.camera.near = 0.5;
        light.shadow.camera.far = 12;
        light.shadow.bias = -0.0008;
      }
      this.scene.add(light);
    }
  }

  // ── asset loading ───────────────────────────────────────────────────────
  async loadGarment(assetUri: string | null, manifest: AssetManifest | null): Promise<LoadResult> {
    if (!assetUri || !manifest) {
      return { ok: false, reason: 'no professional garment asset is registered' };
    }
    if (!manifestIsUsable(manifest)) {
      const errors = validateManifest(manifest)
        .filter((i) => i.severity === 'error')
        .map((i) => `${i.field}: ${i.message}`);
      return { ok: false, reason: `manifest invalid — ${errors.join('; ')}` };
    }

    // A registry uri may be a bundled module id rather than a fetchable URL.
    const resolved = await resolveAssetUri(assetUri);
    if (!resolved) {
      return { ok: false, reason: `asset source could not be resolved: ${assetUri}` };
    }

    try {
      const gltf = await new GLTFLoader().loadAsync(resolved);
      const model = gltf.scene;

      this.normaliseModel(model, manifest);
      this.prepareMeshes(model, manifest);
      this.bindSemanticZones(model, manifest);

      // A missing bound node means the GLB and its manifest disagree; that must
      // fail to the fallback rather than render a garment with no shaq.
      const missing = [...this.requiredZones(manifest)].filter((z) => !this.zoneObjects.has(z));
      if (missing.length > 0) {
        return { ok: false, reason: `asset is missing bound nodes: ${missing.join(', ')}` };
      }

      this.root.clear();
      this.root.add(model);
      this.manifest = manifest;
      this.designDrivenMaterials = supportsDesignDrivenMaterials(manifest);
      this.frameGarment(model);
      this.invalidate();
      return { ok: true, manifest };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : 'GLB load failed' };
    }
  }

  /**
   * Puts the model where the contract says it should be: metres, Y-up, facing
   * the camera, hem on the ground plane.
   *
   * The recentre exists because an asset authored around its bounding-box
   * centre (a reconstruction, typically) would otherwise orbit around its
   * waist and frame half a garment.
   */
  private normaliseModel(model: THREE.Object3D, manifest: AssetManifest) {
    model.scale.setScalar(manifest.scaleToMetres);
    if (manifest.orientation.front === '-z') model.rotation.y = Math.PI;
    if (manifest.orientation.front === '+x') model.rotation.y = -Math.PI / 2;
    if (manifest.orientation.front === '-x') model.rotation.y = Math.PI / 2;

    if (manifest.originPolicy !== 'bounds_centre') return;

    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const centre = box.getCenter(new THREE.Vector3());
    // X/Z to the axis of rotation, Y so the hem rests at zero.
    model.position.set(-centre.x, -box.min.y, -centre.z);
    model.updateMatrixWorld(true);
  }

  /**
   * Repairs defects in the source file that would otherwise read as product
   * bugs, and enables shadows.
   *
   * These are corrections to what the exporter omitted, not decoration:
   * without normals the mesh renders unlit, and glTF's metallicFactor default
   * of 1.0 turns cotton into dark grey metal. See PROTOTYPE_SOURCE_REPAIRS.
   */
  private prepareMeshes(model: THREE.Object3D, manifest: AssetManifest) {
    const prototype = manifest.assetQuality === 'TEMPORARY_REAL_3D_PROTOTYPE';

    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;

      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
      if (geometry && !geometry.attributes.normal) geometry.computeVertexNormals();

      if (!prototype) return;

      for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as
        THREE.MeshStandardMaterial[]) {
        if (!material) continue;
        if (PROTOTYPE_SOURCE_REPAIRS.renderDoubleSided) material.side = THREE.DoubleSide;
        if (PROTOTYPE_SOURCE_REPAIRS.forceNonMetallic) {
          material.metalness = 0;
          material.roughness = PROTOTYPE_SOURCE_REPAIRS.roughness;
        }
        const physical = material as THREE.MeshPhysicalMaterial;
        if (physical.sheen !== undefined) {
          physical.sheen = PROTOTYPE_SOURCE_REPAIRS.sheen;
          physical.sheenRoughness = PROTOTYPE_SOURCE_REPAIRS.sheenRoughness;
        }
        material.needsUpdate = true;
      }
    });
  }

  private requiredZones(manifest: AssetManifest): GarmentZoneId[] {
    return Object.keys(manifest.nodes) as GarmentZoneId[];
  }

  /** Translates the artist's node names into the application's zones. */
  private bindSemanticZones(model: THREE.Object3D, manifest: AssetManifest) {
    this.zoneObjects.clear();
    this.embroideryObjects.clear();
    const byName = new Map<string, THREE.Object3D>();
    model.traverse((child) => byName.set(child.name, child));

    for (const [zone, binding] of Object.entries(manifest.nodes)) {
      const found = binding?.node ? byName.get(binding.node) : undefined;
      if (found) this.zoneObjects.set(zone as GarmentZoneId, found);
    }
    for (const [surface, binding] of Object.entries(manifest.embroiderySurfaces)) {
      const found = binding?.node ? byName.get(binding.node) : undefined;
      if (found) this.embroideryObjects.set(surface as EmbroiderySurfaceId, found);
    }

    const furakha = new THREE.Group();
    for (const binding of Object.values(manifest.furakhaNodes)) {
      const found = binding?.node ? byName.get(binding.node) : undefined;
      if (found) furakha.add(found);
    }
    this.furakhaGroup = furakha.children.length > 0 ? furakha : null;

  }

  /** Frames the garment so it fills the view the way the reference does. */
  private frameGarment(model: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    this.target.set(centre.x, box.min.y + size.y * CAMERA_PRESETS.FRONT.targetHeight, centre.z);
    // Distance that makes the garment occupy roughly 65% of frame height.
    const fovRad = (this.camera.fov * Math.PI) / 180;
    this.radius = (size.y / 0.65 / 2) / Math.tan(fovRad / 2);
    this.updateCamera();
  }

  // ── spec application ────────────────────────────────────────────────────
  applyGarmentSpec(spec: GarmentSpec): void {
    // A prototype is one fused mesh with one baked texture. Driving materials
    // from the design would tint the furakha and the trim along with the
    // cloth, so the asset is left exactly as its author made it — and the
    // renderer says so rather than pretending the design was applied.
    if (!this.designDrivenMaterials) {
      this.renderer.toneMappingExposure = TONE_MAPPING.baseExposure;
      this.invalidate();
      return;
    }

    this.setFabric(spec.fabric.texture);
    this.setFabricColor(spec.colour.hex);

    this.setEmbroidery(spec.embroidery?.id ?? null);
    if (spec.embroidery) {
      spec.embroidery.channels.forEach((channel) => {
        this.setEmbroideryThread(channel.index as 1 | 2 | 3, channel.hex, channel.metallic);
      });
    }
    this.setFurakha(spec.furakha ? { lengthMm: spec.furakha.lengthMm, hex: spec.furakha.hex } : null);

    // Exposure follows the dye, so white keeps highlights and navy keeps folds.
    this.renderer.toneMappingExposure =
      TONE_MAPPING.baseExposure * exposureFor(hexToHsl(spec.colour.hex).l);
  }

  /**
   * Whether the loaded asset's materials are driven by the customer's design.
   * False for a prototype — reported honestly rather than silently ignored.
   */
  get materialsFollowDesign(): boolean {
    return this.designDrivenMaterials;
  }

  setFabric(texture: FabricTexture): void {
    if (!this.designDrivenMaterials) return;
    this.fabricMaterial = this.ensureFabricMaterial();
    // Keep the dye, swap the cloth: the customer changed fabric, not colour.
    const currentHex = `#${this.fabricMaterial.color.getHexString()}`;
    this.applyPbr(this.fabricMaterial, fabricToPbr(materialFor(texture), currentHex));
  }

  setFabricColor(hex: string): void {
    if (!this.designDrivenMaterials) return;
    this.fabricMaterial = this.ensureFabricMaterial();
    const current = this.readPbr(this.fabricMaterial);
    // ONLY the colour changes; weave, roughness and sheen are the cloth's.
    this.applyPbr(this.fabricMaterial, recolour(current, hex));
  }

  setEmbroidery(patternId: string | null): void {
    if (!this.designDrivenMaterials) return;
    // Placement comes from the renderer-independent system, so the 3D path and
    // the vector fallback can never disagree about which zones are embroidered.
    const pattern = getPattern(patternId);
    const placements = computePlacements({
      pattern: pattern ?? null,
      availableSurfaces: [...this.embroideryObjects.keys()],
      includeCuffs: true,
      includeBack: false,
    });
    const activeSurfaces = new Set(placements.map((p) => p.surface).filter(Boolean));
    for (const [surface, object] of this.embroideryObjects) {
      object.visible = activeSurfaces.has(surface);
    }
    this.invalidate();
  }

  setEmbroideryThread(channel: 1 | 2 | 3, hex: string, metallic = false): void {
    if (!this.designDrivenMaterials) return;
    // Only this channel's material is touched, so threads stay independent.
    this.applyPbr(this.ensureThreadMaterial(channel), threadToPbr(threadMaterial(hex, metallic)));
  }

  setFurakha(config: { lengthMm: number; hex: string } | null): void {
    if (!this.designDrivenMaterials) return;
    if (!this.furakhaGroup) return;
    this.furakhaGroup.visible = config !== null;
    this.invalidate();
    if (!config) return;
    this.furakhaGroup.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const m = mesh.material as THREE.MeshPhysicalMaterial;
        if (m.color) m.color.set(config.hex);
      }
    });
  }

  private ensureFabricMaterial(): THREE.MeshPhysicalMaterial {
    if (this.fabricMaterial) return this.fabricMaterial;
    const material = new THREE.MeshPhysicalMaterial({ color: '#FFFFFF', roughness: 0.7 });
    const slot = this.manifest?.materialSlots.fabric;
    for (const [zone, object] of this.zoneObjects) {
      if (zone === 'shaq') continue;
      object.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh && (!slot || (mesh.material as THREE.Material)?.name === slot)) {
          mesh.material = material;
        }
      });
    }
    this.fabricMaterial = material;
    return material;
  }

  private ensureThreadMaterial(channel: 1 | 2 | 3): THREE.MeshPhysicalMaterial {
    const existing = this.threadMaterials.get(channel);
    if (existing) return existing;
    const material = new THREE.MeshPhysicalMaterial({ color: '#FFFFFF', roughness: 0.5 });
    const slot = this.manifest?.materialSlots.embroidery[channel - 1];
    for (const object of this.embroideryObjects.values()) {
      object.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh && slot && (mesh.material as THREE.Material)?.name === slot) {
          mesh.material = material;
        }
      });
    }
    this.threadMaterials.set(channel, material);
    return material;
  }

  /** Marks the scene dirty and asks the surface for a frame. */
  private invalidate() {
    this.needsRender = true;
    this.options.onInvalidate?.();
  }

  /** True when something changed since the last draw. */
  get isDirty(): boolean {
    return this.needsRender;
  }

  private applyPbr(material: THREE.MeshPhysicalMaterial, pbr: Pbr) {
    material.color.set(pbr.color);
    material.roughness = pbr.roughness;
    material.metalness = pbr.metalness;
    material.sheen = pbr.sheen;
    material.sheenRoughness = pbr.sheenRoughness;
    material.sheenColor.set(pbr.sheenColor);
    material.transmission = pbr.transmission;
    material.opacity = pbr.opacity;
    material.transparent = pbr.opacity < 1;
    material.needsUpdate = true;
    this.invalidate();
  }

  private readPbr(material: THREE.MeshPhysicalMaterial): Pbr {
    return {
      color: `#${material.color.getHexString()}`,
      roughness: material.roughness,
      metalness: material.metalness,
      sheen: material.sheen,
      sheenRoughness: material.sheenRoughness,
      sheenColor: `#${material.sheenColor.getHexString()}`,
      normalScale: 1,
      weaveRepeat: 1,
      opacity: material.opacity,
      transmission: material.transmission,
      baseColorTexture: null,
      normalTexture: null,
      roughnessTexture: null,
    };
  }

  // ── camera ──────────────────────────────────────────────────────────────
  setCamera(preset: CameraPresetId): void {
    const p = CAMERA_PRESETS[preset];
    this.view = { azimuth: p.azimuth, elevation: p.elevation, zoom: p.zoom };
    this.camera.fov = p.fov;
    this.camera.updateProjectionMatrix();
    this.updateCamera();
  }

  rotate(deltaAzimuthDeg: number): void {
    this.view.azimuth = ((this.view.azimuth + deltaAzimuthDeg) % 360 + 360) % 360;
    this.updateCamera();
  }

  zoom(scale: number): void {
    this.view.zoom = clampZoom(this.view.zoom * scale);
    this.updateCamera();
  }

  getViewState(): ViewState {
    return { ...this.view };
  }

  private updateCamera() {
    const az = (this.view.azimuth * Math.PI) / 180;
    const el = (clampElevation(this.view.elevation) * Math.PI) / 180;
    const r = this.radius / Math.max(0.01, this.view.zoom);
    this.camera.position.set(
      this.target.x + r * Math.cos(el) * Math.sin(az),
      this.target.y + r * Math.sin(el),
      this.target.z + r * Math.cos(el) * Math.cos(az),
    );
    this.camera.lookAt(this.target);
    this.invalidate();
  }

  setTier(tier: RenderTier): void {
    this.tier = tier;
    const settings = TIER_SETTINGS[tier];
    this.renderer.setPixelRatio(Math.min(this.options.pixelRatio, settings.maxPixelRatio));
    this.renderer.shadowMap.enabled = settings.shadows;
    this.invalidate();
  }

  // ── frame ───────────────────────────────────────────────────────────────
  render(): void {
    if (this.disposed) return;
    this.needsRender = false;
    this.renderer.render(this.scene, this.camera);
    // expo-gl requires this to present the frame; web ignores it.
    this.options.gl.endFrameEXP?.();
    this.options.onFrame?.();
  }

  async capturePreview(): Promise<string | null> {
    if (this.disposed) return null;
    this.render();
    const canvas = this.renderer.domElement as HTMLCanvasElement | undefined;
    if (canvas && typeof canvas.toDataURL === 'function') return canvas.toDataURL('image/png');
    // On native the buffer must be read back through expo-gl's snapshot API,
    // which the GL surface owns; the renderer does not reach for it here.
    return null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
    this.threadMaterials.clear();
    this.zoneObjects.clear();
    this.embroideryObjects.clear();
    this.renderer.dispose();
  }
}
