/**
 * Backend client.
 *
 * No API key ever lives in this app. The device talks only to the proxy in
 * `server/`, which holds the key and enforces the analysis contract. If the
 * proxy is unreachable — which is the normal state until the user starts it —
 * the request falls back to the on-device engine rather than failing.
 */

import Constants from 'expo-constants';
import type { AnalyzeRequest } from '../types/app';
import type { AnalysisResult } from '../types/analysis';
import { validateAnalysisPayload, type ModelPayloadContext } from '../analysis/validate';

const DEFAULT_PORT = 8787;
const TIMEOUT_MS = 60000;

/**
 * Work out where the backend lives.
 *
 * During `expo start` the dev server's host is the developer's machine, which
 * is also where `npm run server` runs — so the LAN IP can be read off the
 * manifest and the user never has to type an address.
 */
export function resolveBaseUrl(configured: string): string {
  const trimmed = configured.trim();
  if (trimmed) return trimmed.replace(/\/+$/, '');

  // `hostUri` is the dev server's `<ip>:<port>`; on classic manifests the same
  // information lives under `debuggerHost`.
  const legacyHost = (Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest
    ?.debuggerHost;
  const hostUri = Constants.expoConfig?.hostUri ?? legacyHost ?? '';

  const host = hostUri.split(':')[0];
  if (host) return `http://${host}:${DEFAULT_PORT}`;
  return `http://localhost:${DEFAULT_PORT}`;
}

export interface AnalyzeOptions {
  baseUrl: string;
  signal?: AbortSignal;
}

export class BackendUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackendUnavailableError';
  }
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new BackendUnavailableError(
        `الخادم ردّ برمز ${response.status}${text ? `: ${text.slice(0, 160)}` : ''}`
      );
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof BackendUnavailableError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new BackendUnavailableError(`تعذّر الوصول إلى الخادم: ${message}`);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function checkHealth(baseUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(`${baseUrl}/api/health`, { signal: controller.signal });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Ask the backend to synthesise an analysis.
 *
 * The response is put through `validateAnalysisPayload` before it is returned:
 * invented verses are dropped, verse text is replaced with the dataset's, and
 * the locally computed sections are copied over the model's.
 */
export async function requestAnalysis(
  request: AnalyzeRequest,
  context: ModelPayloadContext,
  options: AnalyzeOptions
): Promise<AnalysisResult> {
  const payload = await postJson<{ ok: boolean; result?: unknown; error?: string }>(
    `${options.baseUrl}/api/analyze`,
    request,
    options.signal
  );

  if (!payload.ok || !payload.result) {
    throw new BackendUnavailableError(payload.error ?? 'ردّ الخادم بنتيجة فارغة.');
  }

  const { value } = validateAnalysisPayload(payload.result, context);
  return value;
}
