import { Mock3DProvider } from './providers/mock';
import { MeshyProvider } from './providers/meshy';
import { TripoProvider } from './providers/tripo';
import type { ProviderCapabilities, ThreeDProvider } from './providers/types';

/**
 * The AI router.
 *
 * Today it does the simple thing: use the configured provider, fall back to
 * one that is actually credentialed, and never leave a request with nowhere to
 * go — the mock always answers, so a missing API key degrades the *quality* of
 * the result rather than breaking the product.
 *
 * The scoring below is the seam for what this becomes. Once `provider_calls`
 * has real data, `score()` starts reading historical success rates and real
 * costs instead of the static capability numbers each provider declares. That
 * upgrade touches this file and nothing else.
 */

export interface RouterConfig {
  preferred: string;
  meshyApiKey?: string;
  tripoApiKey?: string;
}

export interface RoutingContext {
  /** More than one photo means multi-view reconstruction is possible. */
  imageCount: number;
  /** A retry should not re-pick a provider that just failed. */
  excludeKeys?: string[];
}

export interface RoutingDecision {
  provider: ThreeDProvider;
  /** Why this one. Recorded on the job so a choice can be explained later. */
  reason: string;
  useMultiView: boolean;
}

/**
 * Weights for the capability score.
 *
 * Facial fidelity dominates because the product is a likeness of somebody's
 * child: a cheap figurine that does not look like them is worth nothing.
 */
const WEIGHTS = {
  facialFidelity: 0.5,
  multiView: 0.2,
  speed: 0.15,
  cost: 0.15,
} as const;

function score(capabilities: ProviderCapabilities, context: RoutingContext): number {
  const multiViewValue = context.imageCount > 1 ? (capabilities.multiView ? 1 : 0) : 0.5;
  // Normalised against a two-minute generation and a one-dollar cost, which
  // are roughly the worst numbers we would tolerate.
  const speedValue = Math.max(0, 1 - capabilities.typicalDurationSeconds / 120);
  const costValue = Math.max(0, 1 - capabilities.approxCostUsd / 1);

  return (
    capabilities.facialFidelity * WEIGHTS.facialFidelity +
    multiViewValue * WEIGHTS.multiView +
    speedValue * WEIGHTS.speed +
    costValue * WEIGHTS.cost
  );
}

export class AiRouter {
  private readonly providers: ThreeDProvider[];

  constructor(private readonly config: RouterConfig) {
    this.providers = [
      new Mock3DProvider(),
      new MeshyProvider(config.meshyApiKey),
      new TripoProvider(config.tripoApiKey),
    ];
  }

  all(): readonly ThreeDProvider[] {
    return this.providers;
  }

  get(key: string): ThreeDProvider | undefined {
    return this.providers.find((provider) => provider.key === key);
  }

  /** Providers that could actually serve a request right now. */
  available(exclude: string[] = []): ThreeDProvider[] {
    return this.providers.filter(
      (provider) => provider.isConfigured() && !exclude.includes(provider.key),
    );
  }

  route(context: RoutingContext): RoutingDecision {
    const exclude = context.excludeKeys ?? [];

    const preferred = this.get(this.config.preferred);
    if (preferred && preferred.isConfigured() && !exclude.includes(preferred.key)) {
      return {
        provider: preferred,
        reason: `configured:${preferred.key}`,
        useMultiView: context.imageCount > 1 && preferred.capabilities.multiView,
      };
    }

    // The configured provider is unusable. Pick the best of what is left,
    // preferring a real one over the mock so a missing key does not silently
    // downgrade every customer.
    const candidates = this.available(exclude).filter((provider) => provider.key !== 'mock');
    const ranked = candidates.sort(
      (a, b) => score(b.capabilities, context) - score(a.capabilities, context),
    );

    const chosen = ranked[0];
    if (chosen) {
      return {
        provider: chosen,
        reason: preferred ? `fallback_from:${this.config.preferred}` : 'best_available',
        useMultiView: context.imageCount > 1 && chosen.capabilities.multiView,
      };
    }

    const mock = this.get('mock')!;
    return {
      provider: mock,
      reason: 'no_provider_configured',
      useMultiView: context.imageCount > 1,
    };
  }
}
