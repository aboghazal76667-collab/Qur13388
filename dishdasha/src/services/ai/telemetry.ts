import type { AiGenerationLog } from '@dd/domain/types';
import { nowIso } from '@dd/utils/date';
import { uuid } from '@dd/utils/id';
import type { AiTelemetrySink } from './types';

/**
 * In-memory telemetry sink. Deliberately records only a design hash — never
 * a photo URI, a measurement or a customer identifier — so a log dump can
 * never leak private imagery.
 */
class MemoryTelemetry implements AiTelemetrySink {
  private logs: AiGenerationLog[] = [];

  record(log: AiGenerationLog): void {
    this.logs = [log, ...this.logs].slice(0, 200);
  }

  all(): AiGenerationLog[] {
    return this.logs;
  }
}

export const aiTelemetry: AiTelemetrySink = new MemoryTelemetry();

export const logGeneration = (
  fields: Omit<AiGenerationLog, 'id' | 'createdAt'>,
): AiGenerationLog => {
  const log: AiGenerationLog = { ...fields, id: uuid(), createdAt: nowIso() };
  aiTelemetry.record(log);
  return log;
};

/** Times a call and records it, whatever the outcome. */
export const withTelemetry = async <T>(
  meta: {
    kind: AiGenerationLog['kind'];
    provider: string;
    model: string;
    inputHash: string;
    estimatedCost: number;
  },
  fn: () => Promise<T>,
): Promise<T> => {
  const start = Date.now();
  try {
    const result = await fn();
    logGeneration({
      ...meta,
      status: 'succeeded',
      latencyMs: Date.now() - start,
      error: null,
    });
    return result;
  } catch (error) {
    logGeneration({
      ...meta,
      status: 'failed',
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'unknown error',
    });
    throw error;
  }
};
