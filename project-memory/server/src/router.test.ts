import assert from 'node:assert/strict';

import { AiRouter } from './router';

/**
 * Router tests.
 *
 * These encode the decisions we would otherwise have to re-argue: that a
 * missing credential degrades quality rather than breaking the product, that a
 * retry does not go back to the provider that just failed, and that swapping
 * providers is configuration.
 */

let passed = 0;
function test(name: string, run: () => void): void {
  run();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log('AiRouter');

test('falls back to the mock when nothing is credentialed', () => {
  const router = new AiRouter({ preferred: 'meshy' });
  const decision = router.route({ imageCount: 1 });
  assert.equal(decision.provider.key, 'mock');
  assert.equal(decision.reason, 'no_provider_configured');
});

test('uses the configured provider when it has a key', () => {
  const router = new AiRouter({ preferred: 'meshy', meshyApiKey: 'test-key' });
  const decision = router.route({ imageCount: 1 });
  assert.equal(decision.provider.key, 'meshy');
  assert.equal(decision.reason, 'configured:meshy');
});

test('falls back to another real provider before the mock', () => {
  const router = new AiRouter({ preferred: 'meshy', tripoApiKey: 'test-key' });
  const decision = router.route({ imageCount: 1 });
  assert.equal(decision.provider.key, 'tripo');
  assert.equal(decision.reason, 'fallback_from:meshy');
});

test('a retry avoids the provider that just failed', () => {
  const router = new AiRouter({ preferred: 'meshy', meshyApiKey: 'k1', tripoApiKey: 'k2' });
  const decision = router.route({ imageCount: 1, excludeKeys: ['meshy'] });
  assert.equal(decision.provider.key, 'tripo');
});

test('several photos enable multi-view on a provider that supports it', () => {
  const router = new AiRouter({ preferred: 'meshy', meshyApiKey: 'k' });
  assert.equal(router.route({ imageCount: 3 }).useMultiView, true);
  assert.equal(router.route({ imageCount: 1 }).useMultiView, false);
});

test('switching providers is configuration, not code', () => {
  const withMeshy = new AiRouter({ preferred: 'meshy', meshyApiKey: 'k', tripoApiKey: 'k' });
  const withTripo = new AiRouter({ preferred: 'tripo', meshyApiKey: 'k', tripoApiKey: 'k' });
  assert.equal(withMeshy.route({ imageCount: 1 }).provider.key, 'meshy');
  assert.equal(withTripo.route({ imageCount: 1 }).provider.key, 'tripo');
});

test('every provider satisfies the full interface', () => {
  const router = new AiRouter({ preferred: 'mock' });
  for (const provider of router.all()) {
    assert.equal(typeof provider.generateFromImage, 'function');
    assert.equal(typeof provider.generateFromMultiView, 'function');
    assert.equal(typeof provider.checkStatus, 'function');
    assert.equal(typeof provider.downloadModel, 'function');
    assert.equal(typeof provider.analyzePrintability, 'function');
    assert.equal(typeof provider.isConfigured(), 'boolean');
    assert.ok(provider.capabilities.formats.length > 0);
  }
});

console.log(`\n${passed} router checks passed`);
