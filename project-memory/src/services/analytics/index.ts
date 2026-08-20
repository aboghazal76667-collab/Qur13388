import { log } from '@/lib/log';
import { newId, nowIso } from '@/lib/ids';
import type { AnalyticsEvent } from '@/domain';

/**
 * Product analytics behind an interface.
 *
 * We want to know whether people finish creating a memory and whether
 * generation succeeds. We do not want that curiosity to leak a child's name,
 * a photograph or anything a parent typed, so `props` is typed as scalars and
 * every call site passes counts and enums rather than content.
 */
export interface AnalyticsSink {
  track(name: AnalyticsEventName, props?: AnalyticsProps): void;
  flush(): Promise<void>;
}

export type AnalyticsProps = Record<string, string | number | boolean | null>;

export type AnalyticsEventName =
  | 'onboarding_completed'
  | 'account_created'
  | 'signed_in'
  | 'child_created'
  | 'trait_recorded'
  | 'trait_retired'
  | 'memory_created'
  | 'photo_added'
  | 'photo_quality_checked'
  | 'three_d_requested'
  | 'three_d_succeeded'
  | 'three_d_failed'
  | 'three_d_retried'
  | 'three_d_saved_to_timeline'
  | 'likeness_submitted'
  | 'order_intent'
  | 'app_opened'
  | 'privacy_viewed'
  | 'data_exported'
  | 'content_deleted';

/** Keeps the last N events in memory; the admin overview reads them. */
class MemoryAnalyticsSink implements AnalyticsSink {
  private events: AnalyticsEvent[] = [];
  private readonly limit = 500;

  track(name: AnalyticsEventName, props: AnalyticsProps = {}): void {
    const event: AnalyticsEvent = { id: newId(), name, props, createdAt: nowIso() };
    this.events.push(event);
    if (this.events.length > this.limit) this.events.shift();
    log.debug(`analytics:${name}`, props);
  }

  async flush(): Promise<void> {
    // A vendor sink would post here. The interface is the point.
  }

  all(): readonly AnalyticsEvent[] {
    return this.events;
  }
}

const memorySink = new MemoryAnalyticsSink();
let sink: AnalyticsSink = memorySink;

export function setAnalyticsSink(next: AnalyticsSink): void {
  sink = next;
}

export const analytics = {
  track: (name: AnalyticsEventName, props?: AnalyticsProps) => sink.track(name, props),
  flush: () => sink.flush(),
  recent: () => memorySink.all(),
};
