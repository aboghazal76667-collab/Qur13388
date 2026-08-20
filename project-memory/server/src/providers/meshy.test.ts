import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';

import { MeshyProvider } from './meshy';

/**
 * Meshy integration, exercised against a stand-in server.
 *
 * This is not a mock of our own provider class — it is the real `MeshyProvider`
 * making real HTTP requests over a real socket. Only the far end is a
 * stand-in, replaying the response shapes Meshy documents.
 *
 * The point is to know, before any credential exists, that the request bodies,
 * the authorisation header, the polling loop, the failure mapping and the
 * result mapping are all correct. When a key arrives, the only untested
 * variable left is the model itself.
 */

let passed = 0;
const log = (name: string) => {
  passed += 1;
  console.log(`  ✓ ${name}`);
};

interface Recorded {
  method: string;
  url: string;
  auth: string | undefined;
  body: Record<string, unknown>;
}

async function withStandIn(
  handler: (recorded: Recorded) => { status: number; payload: unknown },
  run: (provider: MeshyProvider, recorded: Recorded[]) => Promise<void>,
): Promise<void> {
  const recorded: Recorded[] = [];

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const entry: Recorded = {
        method: req.method ?? '',
        url: req.url ?? '',
        auth: req.headers.authorization,
        body: raw ? JSON.parse(raw) : {},
      };
      recorded.push(entry);
      const { status, payload } = handler(entry);
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  process.env.MESHY_API_BASE = `http://127.0.0.1:${port}`;

  // Re-imported per run so the module picks up the stand-in's port.
  const { MeshyProvider: Fresh } = await import(`./meshy.ts?cache=${port}`);
  const provider = new Fresh('test-key-not-a-real-credential') as MeshyProvider;

  try {
    await run(provider, recorded);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    delete process.env.MESHY_API_BASE;
  }
}

console.log('MeshyProvider against a stand-in server');

await withStandIn(
  () => ({ status: 200, payload: { result: 'task-abc' } }),
  async (provider, recorded) => {
    const status = await provider.generateFromImage({
      jobId: 'job-1',
      images: [{ url: 'https://example.test/signed.jpg', view: 'front' }],
      style: 'realistic',
    });

    assert.equal(status.providerJobId, 'task-abc');
    assert.equal(status.state, 'queued');

    const call = recorded[0];
    assert.equal(call.method, 'POST');
    assert.ok(call.url.includes('/openapi/v1/image-to-3d'));
    // The key must travel as a bearer token and nowhere else.
    assert.equal(call.auth, 'Bearer test-key-not-a-real-credential');
    assert.equal(call.body.image_url, 'https://example.test/signed.jpg');
    assert.equal(call.body.should_texture, true);
    log('single image: correct endpoint, auth header and body');
  },
);

await withStandIn(
  () => ({ status: 200, payload: { result: 'task-multi' } }),
  async (provider, recorded) => {
    await provider.generateFromMultiView({
      jobId: 'job-2',
      images: [
        { url: 'https://example.test/front.jpg', view: 'front' },
        { url: 'https://example.test/side.jpg', view: 'left' },
        { url: 'https://example.test/back.jpg', view: 'back' },
      ],
    });

    const call = recorded[0];
    assert.ok(call.url.includes('/openapi/v1/multi-image-to-3d'));
    assert.equal(call.body.front_image_url, 'https://example.test/front.jpg');
    assert.equal(call.body.left_image_url, 'https://example.test/side.jpg');
    assert.equal(call.body.back_image_url, 'https://example.test/back.jpg');
    assert.equal((call.body.image_urls as string[]).length, 3);
    log('multi-view: views map to the provider’s named slots');
  },
);

await withStandIn(
  (recorded) =>
    recorded.method === 'POST'
      ? { status: 200, payload: { result: 'task-multi' } }
      : { status: 200, payload: { status: 'IN_PROGRESS', progress: 40 } },
  async (provider, recorded) => {
    await provider.generateFromMultiView({
      jobId: 'job-3',
      images: [
        { url: 'https://example.test/a.jpg', view: 'front' },
        { url: 'https://example.test/b.jpg', view: 'left' },
      ],
    });
    await provider.checkStatus('task-multi');

    // Polling the single-image endpoint for a multi-image task would 404 and
    // read as a failed generation.
    assert.ok(recorded[1].url.includes('/openapi/v1/multi-image-to-3d/task-multi'));
    log('multi-view tasks are polled on the multi-view endpoint');
  },
);

await withStandIn(
  () => ({ status: 200, payload: { status: 'IN_PROGRESS', progress: 42 } }),
  async (provider) => {
    const status = await provider.checkStatus('task-abc');
    assert.equal(status.state, 'running');
    assert.equal(status.progress, 0.42);
    assert.equal(status.result, null);
    log('in-progress maps to running with real progress');
  },
);

await withStandIn(
  () => ({
    status: 200,
    payload: {
      status: 'SUCCEEDED',
      progress: 100,
      model_urls: { glb: 'https://example.test/model.glb', obj: 'https://example.test/model.obj' },
      thumbnail_url: 'https://example.test/preview.png',
    },
  }),
  async (provider) => {
    const status = await provider.checkStatus('task-abc');
    assert.equal(status.state, 'succeeded');
    assert.equal(status.progress, 1);
    assert.equal(status.result?.modelUrl, 'https://example.test/model.glb');
    assert.equal(status.result?.format, 'glb');
    assert.equal(status.result?.previewImageUrl, 'https://example.test/preview.png');
    assert.ok((status.result?.estimatedCostUsd ?? 0) > 0, 'a generation must be costed');
    log('success maps to a model URL, preview and cost');
  },
);

await withStandIn(
  () => ({ status: 200, payload: { status: 'FAILED', task_error: { message: 'no subject found' } } }),
  async (provider) => {
    const status = await provider.checkStatus('task-abc');
    assert.equal(status.state, 'failed');
    assert.equal(status.errorCode, 'provider_generation_failed');
    assert.equal(status.result, null);
    log('provider failure maps to a failed job, not a crash');
  },
);

await withStandIn(
  () => ({ status: 401, payload: { message: 'invalid api key' } }),
  async (provider) => {
    // A bad credential must surface as an error the caller can log, never as a
    // silently empty result that would look like a finished generation.
    await assert.rejects(() => provider.checkStatus('task-abc'), /meshy 401/);
    log('a rejected credential raises rather than returning nothing');
  },
);

{
  const unconfigured = new MeshyProvider(undefined);
  assert.equal(unconfigured.isConfigured(), false);
  await assert.rejects(
    () => unconfigured.generateFromImage({ jobId: 'j', images: [{ url: 'x', view: 'front' }] }),
    /no API key/,
  );
  log('without a key the provider reports unconfigured and refuses to call');
}

{
  // Printability is not assessed by Meshy, and the provider says so rather
  // than returning a confident-looking report it did not compute.
  const provider = new MeshyProvider('k');
  const report = await provider.analyzePrintability('https://example.test/model.glb');
  assert.equal(report.score, 0);
  assert.deepEqual(report.warnings, ['printability_not_assessed']);
  log('printability is reported as not assessed, not as passing');
}

console.log(`\n${passed} Meshy integration checks passed`);
