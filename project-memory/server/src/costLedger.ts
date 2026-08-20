import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The cost ledger.
 *
 * One row per outbound provider call, whether it succeeded or not. This is the
 * only way we will ever answer the two questions that decide whether the
 * business works: what does one figurine actually cost us, and which provider
 * fails least. Recording an estimate is far better than recording nothing —
 * an estimate can be reconciled against an invoice later; a gap cannot.
 */
export interface CostEntry {
  jobId: string;
  providerKey: string;
  model?: string | null;
  operation: 'generate' | 'status' | 'download' | 'printability';
  durationMs: number;
  success: boolean;
  httpStatus?: number | null;
  creditsUsed?: number | null;
  estimatedCostUsd?: number | null;
  errorCode?: string | null;
}

export async function recordCall(client: SupabaseClient, entry: CostEntry): Promise<void> {
  const { error } = await client.from('provider_calls').insert({
    job_id: entry.jobId,
    provider_key: entry.providerKey,
    model: entry.model ?? null,
    operation: entry.operation,
    duration_ms: Math.round(entry.durationMs),
    success: entry.success,
    http_status: entry.httpStatus ?? null,
    credits_used: entry.creditsUsed ?? null,
    estimated_cost_usd: entry.estimatedCostUsd ?? null,
    error_code: entry.errorCode ?? null,
  });

  if (error) {
    // A failed ledger write must never fail the parent's request. It is our
    // bookkeeping problem, not theirs.
    console.error('[pm] cost ledger write failed', error.message);
  }
}

/** Times an operation and files the result, whichever way it goes. */
export async function measured<T>(
  client: SupabaseClient,
  entry: Omit<CostEntry, 'durationMs' | 'success'>,
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await operation();
    await recordCall(client, { ...entry, durationMs: Date.now() - startedAt, success: true });
    return result;
  } catch (error) {
    await recordCall(client, {
      ...entry,
      durationMs: Date.now() - startedAt,
      success: false,
      errorCode: error instanceof Error ? error.message.slice(0, 120) : 'unknown',
    });
    throw error;
  }
}
