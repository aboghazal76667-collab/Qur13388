import type { AnalyticsEvent, AnalyticsEventName } from '@dd/domain/types';
import { nowIso } from '@dd/utils/date';

/**
 * ANALYTICS ABSTRACTION.
 *
 * The default sink is local and in-memory: nothing leaves the device, no
 * third-party SDK is bundled, and no identifier is collected. A hosted
 * provider can be added later behind the same interface — with consent.
 */
export interface AnalyticsSink {
  readonly name: string;
  track(event: AnalyticsEvent): void;
  recent(limit?: number): AnalyticsEvent[];
}

class DebugAnalytics implements AnalyticsSink {
  readonly name = 'local-debug';
  private events: AnalyticsEvent[] = [];

  track(event: AnalyticsEvent): void {
    this.events = [event, ...this.events].slice(0, 300);
    if (__DEV__) {
      // Visible in the Metro console while demoing; no network call.
      console.log(`[analytics] ${event.name}`, event.props);
    }
  }

  recent(limit = 50): AnalyticsEvent[] {
    return this.events.slice(0, limit);
  }
}

export const analytics: AnalyticsSink = new DebugAnalytics();

export const track = (
  name: AnalyticsEventName,
  props: Record<string, string | number | boolean | null> = {},
): void => analytics.track({ name, props, at: nowIso() });

/** Funnel counters for the future product-metrics dashboard. */
export const funnelCounts = (events: AnalyticsEvent[]) => {
  const count = (name: AnalyticsEventName) => events.filter((e) => e.name === name).length;
  const designStarted = count('design_started');
  const checkoutStarted = count('checkout_started');
  const ordersCreated = count('order_created');
  const previews = count('preview_generated');
  const paletteApplied = count('ai_palette_applied');
  const stylistUsed = count('ai_stylist_used');
  return {
    designStarted,
    checkoutStarted,
    ordersCreated,
    previews,
    designToCheckout: designStarted ? checkoutStarted / designStarted : 0,
    checkoutToOrder: checkoutStarted ? ordersCreated / checkoutStarted : 0,
    previewToOrder: previews ? ordersCreated / previews : 0,
    stylistAdoption: designStarted ? stylistUsed / designStarted : 0,
    paletteAdoption: stylistUsed ? paletteApplied / stylistUsed : 0,
  };
};
