import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

import { log } from '@/lib/log';
import {
  extensionFromUri,
  mimeFromExtension,
  storagePathFor,
  type BucketFolder,
} from '../storagePaths';

// Re-exported so callers have one import for "where does this file go".
export { extensionFromUri, mimeFromExtension, storagePathFor };
export type { BucketFolder };

/**
 * Private, per-family file storage on the device.
 *
 * The image picker hands back a URI in a cache directory the OS is free to
 * purge. A family archive cannot lose photographs that way, so every picked
 * image is copied into the app's documents directory under the same path shape
 * the cloud bucket uses:
 *
 *   families/{familyId}/children/{childId}/memories/{memoryId}/{assetId}.jpg
 *
 * Keeping the two layouts identical means moving a family from device storage
 * to Supabase later is a copy, not a redesign.
 */

const ROOT = 'project-memory';

function documentRoot(): string | null {
  const dir = FileSystem.documentDirectory;
  return dir ? `${dir}${ROOT}/` : null;
}

/** Absolute on-device URI for a logical storage path. */
export function localUriFor(storagePath: string): string | null {
  const root = documentRoot();
  return root ? `${root}${storagePath}` : null;
}

async function ensureParentDirectory(fileUri: string): Promise<void> {
  const parent = fileUri.slice(0, fileUri.lastIndexOf('/'));
  const info = await FileSystem.getInfoAsync(parent);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(parent, { intermediates: true });
  }
}

export interface StoredFile {
  storagePath: string;
  uri: string;
  byteSize: number | null;
}

/**
 * Copies a picked file into durable storage. On web there is no document
 * directory, so the original (blob) URI is kept — good enough for the browser
 * preview, and the cloud backend is the real answer there anyway.
 */
export async function storeLocalFile(sourceUri: string, storagePath: string): Promise<StoredFile> {
  const target = localUriFor(storagePath);
  if (!target || Platform.OS === 'web') {
    return { storagePath, uri: sourceUri, byteSize: null };
  }

  try {
    await ensureParentDirectory(target);
    await FileSystem.copyAsync({ from: sourceUri, to: target });
    const info = await FileSystem.getInfoAsync(target);
    return {
      storagePath,
      uri: target,
      byteSize: info.exists && 'size' in info ? (info.size as number) : null,
    };
  } catch (error) {
    // Losing the copy is recoverable — losing the photo is not, so fall back
    // to the original URI rather than failing the whole save.
    log.warn('could not copy file into durable storage', { error: String(error), storagePath });
    return { storagePath, uri: sourceUri, byteSize: null };
  }
}

export async function deleteLocalFile(storagePath: string): Promise<void> {
  const target = localUriFor(storagePath);
  if (!target || Platform.OS === 'web') return;
  try {
    await FileSystem.deleteAsync(target, { idempotent: true });
  } catch (error) {
    log.warn('could not delete stored file', { error: String(error), storagePath });
  }
}

/** Removes an entire family tree from disk — used by account deletion. */
export async function deleteLocalTree(prefix: string): Promise<void> {
  const target = localUriFor(prefix);
  if (!target || Platform.OS === 'web') return;
  try {
    await FileSystem.deleteAsync(target, { idempotent: true });
  } catch (error) {
    log.warn('could not delete stored tree', { error: String(error), prefix });
  }
}
