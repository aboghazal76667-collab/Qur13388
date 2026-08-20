import * as ImagePicker from 'expo-image-picker';

import { AppError } from '@/lib/errors';
import { log } from '@/lib/log';
import type { PhotoInput } from '@/services/photoQuality';

/**
 * Photo selection.
 *
 * We ask for the smallest permission that does the job and we compress on the
 * way in: a phone camera produces 12 MP files, and a family archive that
 * uploads originals over a patchy mobile connection is an archive that fails.
 * 0.8 quality at full resolution keeps enough detail for a figurine.
 */

export const maxPhotosPerMemory = 5;

export interface PickedPhoto extends PhotoInput {
  uri: string;
  width: number | null;
  height: number | null;
  byteSize: number | null;
  fileName: string | null;
}

function toPickedPhoto(asset: ImagePicker.ImagePickerAsset): PickedPhoto {
  return {
    uri: asset.uri,
    width: asset.width ?? null,
    height: asset.height ?? null,
    byteSize: asset.fileSize ?? null,
    fileName: asset.fileName ?? null,
  };
}

export async function pickPhotos(limit: number): Promise<PickedPhoto[]> {
  if (limit <= 0) return [];

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new AppError('permission', 'media library permission denied');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 0.8,
    exif: false,
  });

  if (result.canceled) return [];
  return result.assets.slice(0, limit).map(toPickedPhoto);
}

export async function capturePhoto(): Promise<PickedPhoto | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new AppError('permission', 'camera permission denied');
  }

  const result = await ImagePicker.launchCameraAsync({ quality: 0.8, exif: false });
  if (result.canceled || !result.assets[0]) return null;
  return toPickedPhoto(result.assets[0]);
}

/** Single square image for a child's profile photo. */
export async function pickAvatar(): Promise<PickedPhoto | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new AppError('permission', 'media library permission denied');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
    exif: false,
  });

  if (result.canceled || !result.assets[0]) return null;
  log.debug('avatar picked');
  return toPickedPhoto(result.assets[0]);
}
