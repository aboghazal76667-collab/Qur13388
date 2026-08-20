import type { PhotoSignals } from './signals';

export type { PhotoSignals } from './signals';

/**
 * 3D readiness.
 *
 * The question this replaces "photo quality" with is deliberately different.
 * "Is this a technically decent image?" is answerable from optics alone and is
 * not what a parent needs to know. "Can these images help reconstruct this
 * child?" is the real question — and answering it honestly means being exact
 * about which parts we can measure and which we cannot.
 */

/**
 * What the active analyser genuinely does.
 *
 * This exists because the previous system reported "Face: Excellent" without
 * anything having looked for a face. Every capability here is false until
 * something real implements it, and the UI is required to read these flags
 * rather than assume. Claiming a capability we do not have is the specific
 * failure this type is here to prevent.
 */
export interface VisionCapabilities {
  /** Decodes and measures actual pixels rather than file metadata. */
  readsPixels: boolean;
  measuresSharpness: boolean;
  measuresExposure: boolean;
  measuresFraming: boolean;
  measuresBackground: boolean;
  /** Recognises that a person is present. */
  detectsPerson: boolean;
  /** Locates a face, its size and its angle. */
  detectsFace: boolean;
  /** Sees whether the whole body, hands or feet are visible. */
  detectsBody: boolean;
  /** Works out by itself whether a photo is a front, side or back view. */
  classifiesView: boolean;
  /** Confirms two photos show the same child. */
  verifiesIdentity: boolean;
}

/**
 * What a photo is for in a reconstruction.
 *
 * Declared by the parent, never guessed: `classifiesView` is false, so the app
 * asks rather than pretending to know. Asking is also better product — a parent
 * knows instantly which picture shows their child's face.
 */
export type ViewRole =
  | 'face'
  | 'front_body'
  | 'full_body'
  | 'side'
  | 'back'
  | 'detail'
  | 'unspecified';

export const viewRoles: readonly ViewRole[] = [
  'face',
  'front_body',
  'full_body',
  'side',
  'back',
  'detail',
];

/** A measured concern about one photo, in words a parent can act on. */
export interface ReadinessIssue {
  key:
    | 'too_small'
    | 'blurred'
    | 'too_dark'
    | 'too_bright'
    | 'low_contrast'
    | 'subject_small'
    | 'busy_background'
    | 'strong_colour_cast'
    | 'duplicate';
  /** How much it matters: 'blocking' is rare and never silently prevents use. */
  severity: 'note' | 'warning';
}

export interface PhotoReadiness {
  /** Identifies the photo within the memory. */
  photoId: string;
  /** 0–100, from measured optics only. Coverage is scored per collection. */
  score: number;
  signals: PhotoSignals;
  issues: ReadinessIssue[];
  /** Parent-declared. */
  role: ViewRole;
  analyzerId: string;
  analyzerVersion: string;
}

export type CoverageState = 'present' | 'missing';

export interface CoverageItem {
  role: ViewRole;
  state: CoverageState;
  /** Whether missing this materially hurts the result. */
  importance: 'needed' | 'helpful';
}

export interface CollectionReadiness {
  /** 0–100 across the whole set: optics and coverage together. */
  score: number;
  /** Enough to attempt a generation at all. One usable photo suffices. */
  canGenerate: boolean;
  photos: PhotoReadiness[];
  coverage: CoverageItem[];
  /** Pairs of photos that look like the same shot. */
  duplicatePairs: { a: string; b: string; distance: number }[];
  /** Photos that look unlike the rest of the set and deserve a second look. */
  outliers: string[];
  /** What the analyser could and could not examine. */
  capabilities: VisionCapabilities;
}

export interface AnalysedPhoto {
  photoId: string;
  role: ViewRole;
  signals: PhotoSignals;
}

/**
 * The seam a real vision model plugs into.
 *
 * A server-side implementation with person and face detection satisfies the
 * same interface and simply reports more capabilities as true; every screen
 * reads the flags, so nothing above this line changes when that lands.
 */
export interface ReadinessAnalyzer {
  readonly id: string;
  readonly version: string;
  readonly capabilities: VisionCapabilities;
  /** Decodes and measures one photo. */
  analyze(uri: string, photoId: string, role: ViewRole): Promise<AnalysedPhoto>;
}

/**
 * What the on-device pixel analyser genuinely does.
 *
 * Declared here, beside the type, and deliberately free of any import from the
 * implementation: it is a statement about capability that tests and UI can read
 * without pulling in React Native, and it is the contract the UI relies on when
 * deciding what it is allowed to claim.
 */
export const pixelAnalyzerCapabilities: VisionCapabilities = {
  readsPixels: true,
  measuresSharpness: true,
  measuresExposure: true,
  measuresFraming: true,
  measuresBackground: true,
  // Not implemented. These need a vision model; nothing on device approximates
  // them, and no part of the product may imply otherwise.
  detectsPerson: false,
  detectsFace: false,
  detectsBody: false,
  classifiesView: false,
  verifiesIdentity: false,
};
