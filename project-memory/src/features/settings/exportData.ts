import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

import { getBackend } from '@/data';
import { AppError } from '@/lib/errors';
import { log } from '@/lib/log';

export interface ExportResult {
  children: number;
  memories: number;
  /** Where the file landed, or null on web where there is no file system. */
  path: string | null;
}

/**
 * Writes the family's data to a JSON file on the device.
 *
 * A right to your data that produces nothing you can hold is not a right, so
 * this actually writes a file and tells the parent where it is. Photographs
 * are listed by path rather than embedded: they are already on the phone, and
 * a base64 copy of a family's whole photo library would be both enormous and
 * a second copy of the thing we are trying to protect.
 */
export async function exportFamilyData(): Promise<ExportResult> {
  const data = await getBackend().family.exportAll();

  const children = Array.isArray((data as { children?: unknown[] }).children)
    ? (data as { children: unknown[] }).children.length
    : 0;
  const memories = Array.isArray((data as { memories?: unknown[] }).memories)
    ? (data as { memories: unknown[] }).memories.length
    : 0;

  const directory = FileSystem.documentDirectory;
  if (!directory || Platform.OS === 'web') {
    log.debug('export assembled without a file system', { children, memories });
    return { children, memories, path: null };
  }

  const fileName = `project-memory-export-${new Date().toISOString().slice(0, 10)}.json`;
  const target = `${directory}${fileName}`;

  try {
    await FileSystem.writeAsStringAsync(target, JSON.stringify(data, null, 2));
  } catch (error) {
    log.error('export write failed', { error: String(error) });
    throw new AppError('unknown', String(error));
  }

  return { children, memories, path: fileName };
}
