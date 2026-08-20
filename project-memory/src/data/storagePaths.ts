/**
 * Storage path construction.
 *
 * Pure, and deliberately free of any React Native import, because the layout
 * it produces is shared by the device backend, the cloud backend and the SQL
 * storage policy — and because logic this load-bearing should be testable in
 * plain Node.
 *
 * The layout is:
 *
 *   families/{familyId}/children/{childId}/memories/{memoryId}/{folder}/{assetId}.{ext}
 *
 * The family id sits in a fixed position on purpose: the storage policy reads
 * the second segment to decide who may touch an object, which keeps that rule
 * a one-line check rather than a parser.
 */

export type BucketFolder =
  | 'originals'
  | 'processed'
  | 'previews'
  | 'models'
  | 'print'
  | 'story'
  | 'avatars';

export function storagePathFor(params: {
  familyId: string;
  childId?: string | null;
  memoryId?: string | null;
  assetId: string;
  extension: string;
  /** Segregates originals from derivatives, 3D output and print files. */
  bucketFolder?: BucketFolder;
}): string {
  const { familyId, childId, memoryId, assetId, extension, bucketFolder = 'originals' } = params;
  const segments = [`families/${familyId}`];
  if (childId) segments.push(`children/${childId}`);
  if (memoryId) segments.push(`memories/${memoryId}`);
  segments.push(bucketFolder, `${assetId}.${extension}`);
  return segments.join('/');
}

export function extensionFromUri(uri: string, fallback = 'jpg'): string {
  const match = /\.([a-zA-Z0-9]{1,5})(?:\?|#|$)/.exec(uri);
  const ext = match?.[1]?.toLowerCase();
  if (!ext || ext.length > 5) return fallback;
  return ext === 'jpeg' ? 'jpg' : ext;
}

export function mimeFromExtension(extension: string): string {
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'heic':
      return 'image/heic';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'mp4':
      return 'video/mp4';
    case 'm4a':
      return 'audio/mp4';
    case 'glb':
      return 'model/gltf-binary';
    default:
      return 'image/jpeg';
  }
}
