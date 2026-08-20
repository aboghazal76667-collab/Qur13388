import { createServer } from 'node:http';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { AiRouter } from './router';
import { measured } from './costLedger';
import type { SourceImage } from './providers/types';

/**
 * The Project Memory API.
 *
 * Its whole reason to exist is the rule that no vendor API key may ever reach
 * a phone. The app asks this server for a figurine; this server decides which
 * provider to use, calls it with credentials the app has never seen, and
 * writes the result back to the database.
 *
 * Deliberately built on `node:http` with no framework. It has four routes and
 * one job, and a dependency we do not take is a dependency we never have to
 * patch.
 */

const PORT = Number(process.env.PORT ?? 8787);
const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const BUCKET = 'family-media';
/** Long enough for a provider to fetch the image, short enough to matter. */
const PROVIDER_URL_TTL_SECONDS = 60 * 20;

const router = new AiRouter({
  preferred: process.env.THREE_D_PROVIDER ?? 'mock',
  meshyApiKey: process.env.MESHY_API_KEY,
  tripoApiKey: process.env.TRIPO_API_KEY,
});

/** Service-role client. Bypasses row-level security, so it never leaves here. */
function serviceClient(): SupabaseClient {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Resolves the caller from their bearer token.
 *
 * The token proves who they are; every authorisation decision after this is
 * made against the database, never against anything the client sent us.
 */
async function authenticate(authorisation: string | undefined): Promise<string | null> {
  const token = authorisation?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const client = serviceClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

/** Confirms the caller belongs to the family that owns the memory. */
async function authoriseMemory(
  client: SupabaseClient,
  userId: string,
  memoryId: string,
): Promise<{ familyId: string; childId: string } | null> {
  const { data: memory } = await client
    .from('memories')
    .select('family_id, child_id')
    .eq('id', memoryId)
    .maybeSingle<{ family_id: string; child_id: string }>();
  if (!memory) return null;

  const { data: membership } = await client
    .from('family_members')
    .select('profile_id')
    .eq('family_id', memory.family_id)
    .eq('profile_id', userId)
    .maybeSingle();
  if (!membership) return null;

  return { familyId: memory.family_id, childId: memory.child_id };
}

/**
 * Mints short-lived URLs the provider can fetch.
 *
 * The provider gets a link that expires, not a permanent one, and only for the
 * photos this job needs.
 */
async function signSourceImages(
  client: SupabaseClient,
  assetIds: string[],
): Promise<SourceImage[]> {
  if (assetIds.length === 0) return [];

  const { data: assets } = await client
    .from('assets')
    .select('id, storage_path, meta')
    .in('id', assetIds)
    .returns<{ id: string; storage_path: string; meta: Record<string, unknown> }[]>();

  const images: SourceImage[] = [];
  for (const asset of assets ?? []) {
    const { data } = await client.storage
      .from(BUCKET)
      .createSignedUrl(asset.storage_path, PROVIDER_URL_TTL_SECONDS);
    if (!data?.signedUrl) continue;

    // The view is recorded on the asset when a parent labels a photo. Until
    // that UI exists, the first photo is the front view and the rest are
    // unspecified, which is exactly what the providers expect.
    const declared = typeof asset.meta?.view === 'string' ? asset.meta.view : null;
    images.push({
      url: data.signedUrl,
      view: (declared as SourceImage['view']) ?? (images.length === 0 ? 'front' : 'unspecified'),
    });
  }
  return images;
}

function stageFor(status: string): number {
  const map: Record<string, number> = {
    uploaded: 0,
    image_checked: 1,
    generating: 2,
    raw_model_ready: 3,
    quality_review: 3,
    printability_check: 4,
    approved: 4,
  };
  return map[status] ?? 0;
}

/* -------------------------------------------------------------- handlers */

async function createJob(userId: string, body: Record<string, unknown>) {
  const memoryId = String(body.memoryId ?? '');
  const sourceAssetIds = Array.isArray(body.sourceAssetIds) ? (body.sourceAssetIds as string[]) : [];
  const retryOfJobId = body.retryOfJobId ? String(body.retryOfJobId) : null;

  if (!memoryId || sourceAssetIds.length === 0) {
    return { status: 400, payload: { error: 'memoryId and sourceAssetIds are required' } };
  }
  if (sourceAssetIds.length > 5) {
    return { status: 400, payload: { error: 'at most 5 source photos' } };
  }

  const client = serviceClient();
  const context = await authoriseMemory(client, userId, memoryId);
  if (!context) return { status: 403, payload: { error: 'not your memory' } };

  // A retry must not re-pick the provider that just failed.
  let exclude: string[] = [];
  let attempt = 1;
  if (retryOfJobId) {
    const { data: previous } = await client
      .from('three_d_jobs')
      .select('provider_key, attempt, status')
      .eq('id', retryOfJobId)
      .maybeSingle<{ provider_key: string | null; attempt: number; status: string }>();
    if (previous) {
      attempt = previous.attempt + 1;
      if (previous.status === 'failed' && previous.provider_key) {
        exclude = [previous.provider_key];
      }
    }
  }

  const decision = router.route({ imageCount: sourceAssetIds.length, excludeKeys: exclude });

  const { data: job, error: insertError } = await client
    .from('three_d_jobs')
    .insert({
      family_id: context.familyId,
      child_id: context.childId,
      memory_id: memoryId,
      requested_by: userId,
      status: 'uploaded',
      provider_key: decision.provider.key,
      source_asset_ids: sourceAssetIds,
      retry_of_job_id: retryOfJobId,
      attempt,
      params: { routing: decision.reason, multiView: decision.useMultiView },
    })
    .select('*')
    .single();
  if (insertError || !job) {
    return { status: 500, payload: { error: 'could not create job' } };
  }

  const images = await signSourceImages(client, sourceAssetIds);
  if (images.length === 0) {
    await client
      .from('three_d_jobs')
      .update({ status: 'failed', error_code: 'source_images_unavailable', completed_at: new Date().toISOString() })
      .eq('id', job.id);
    return { status: 502, payload: { error: 'source images unavailable' } };
  }

  await client.from('three_d_jobs').update({ status: 'image_checked', stage_index: 1, progress: 0.16 }).eq('id', job.id);

  try {
    const request = { jobId: job.id as string, images, style: 'realistic' as const, targetHeightMm: 110 };
    const started = await measured(
      client,
      {
        jobId: job.id as string,
        providerKey: decision.provider.key,
        operation: 'generate',
        estimatedCostUsd: decision.provider.capabilities.approxCostUsd,
      },
      () =>
        decision.useMultiView
          ? decision.provider.generateFromMultiView(request)
          : decision.provider.generateFromImage(request),
    );

    const { data: updated } = await client
      .from('three_d_jobs')
      .update({
        status: 'generating',
        provider_job_id: started.providerJobId,
        stage_index: 2,
        progress: 0.3,
      })
      .eq('id', job.id)
      .select('*')
      .single();

    return { status: 200, payload: { job: updated ?? job } };
  } catch (error) {
    console.error('[pm] generation dispatch failed', error);
    const { data: failed } = await client
      .from('three_d_jobs')
      .update({
        status: 'failed',
        error_code: 'provider_dispatch_failed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .select('*')
      .single();
    // The parent sees "your photos are safe" — never this message.
    return { status: 200, payload: { job: failed ?? job } };
  }
}

async function refreshJob(userId: string, jobId: string) {
  const client = serviceClient();

  const { data: job } = await client.from('three_d_jobs').select('*').eq('id', jobId).maybeSingle();
  if (!job) return { status: 404, payload: { error: 'not found' } };

  const { data: membership } = await client
    .from('family_members')
    .select('profile_id')
    .eq('family_id', job.family_id)
    .eq('profile_id', userId)
    .maybeSingle();
  if (!membership) return { status: 403, payload: { error: 'not your job' } };

  if (job.completed_at || job.status === 'failed' || !job.provider_job_id) {
    return { status: 200, payload: { job } };
  }

  const provider = router.get(job.provider_key ?? 'mock');
  if (!provider) return { status: 200, payload: { job } };

  let status;
  try {
    status = await measured(
      client,
      { jobId, providerKey: provider.key, operation: 'status' },
      () => provider.checkStatus(job.provider_job_id as string),
    );
  } catch (error) {
    // A status check failing is not a generation failing. Leave the job alone
    // and let the next poll try again.
    console.error('[pm] status check failed', error);
    return { status: 200, payload: { job } };
  }

  if (status.state === 'failed') {
    const { data: updated } = await client
      .from('three_d_jobs')
      .update({
        status: 'failed',
        error_code: status.errorCode ?? 'provider_generation_failed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select('*')
      .single();
    return { status: 200, payload: { job: updated ?? job } };
  }

  if (status.state !== 'succeeded' || !status.result) {
    const { data: updated } = await client
      .from('three_d_jobs')
      .update({
        status: 'generating',
        progress: Math.max(Number(job.progress ?? 0), status.progress),
        stage_index: stageFor('generating'),
      })
      .eq('id', jobId)
      .select('*')
      .single();
    return { status: 200, payload: { job: updated ?? job } };
  }

  // Succeeded. Record the model, then run printability before we would ever
  // let this reach a printer.
  const printability = provider.capabilities.printability
    ? await provider.analyzePrintability(status.result.modelUrl ?? '').catch(() => null)
    : null;

  await client.from('three_d_models').upsert(
    {
      job_id: jobId,
      family_id: job.family_id,
      child_id: job.child_id,
      memory_id: job.memory_id,
      format: status.result.format,
      polycount: status.result.polycount,
      printability,
      is_print_ready: (printability?.score ?? 0) >= 80,
      meta: {
        provider: provider.key,
        // Kept so the app can show a demo preview when the provider produced
        // no file of its own.
        previewKind: status.result.modelUrl ? 'model' : 'procedural',
        seed: jobId,
        modelUrl: status.result.modelUrl,
        previewImageUrl: status.result.previewImageUrl,
      },
    },
    { onConflict: 'job_id' },
  );

  const { data: updated } = await client
    .from('three_d_jobs')
    .update({
      status: 'quality_review',
      progress: 1,
      stage_index: stageFor('quality_review'),
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .select('*')
    .single();

  return { status: 200, payload: { job: updated ?? job } };
}

/* ---------------------------------------------------------------- server */

function readBody(request: import('node:http').IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      // A request body here is a few ids. Anything larger is a mistake or an
      // attack, and neither deserves memory.
      if (size > 64 * 1024) {
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolve(chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        resolve({});
      }
    });
    request.on('error', () => resolve({}));
  });
}

const server = createServer(async (request, response) => {
  const send = (status: number, payload: unknown) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(payload));
  };

  try {
    const url = new URL(request.url ?? '/', `http://localhost:${PORT}`);

    if (request.method === 'GET' && url.pathname === '/health') {
      return send(200, {
        ok: true,
        providers: router.all().map((provider) => ({
          key: provider.key,
          configured: provider.isConfigured(),
        })),
      });
    }

    if (request.method !== 'POST') return send(404, { error: 'not found' });

    const userId = await authenticate(request.headers.authorization);
    if (!userId) return send(401, { error: 'unauthorised' });

    if (url.pathname === '/v1/three-d/jobs') {
      const body = await readBody(request);
      const result = await createJob(userId, body);
      return send(result.status, result.payload);
    }

    const refreshMatch = /^\/v1\/three-d\/jobs\/([0-9a-fA-F-]{36})\/refresh$/.exec(url.pathname);
    if (refreshMatch) {
      const result = await refreshJob(userId, refreshMatch[1]!);
      return send(result.status, result.payload);
    }

    return send(404, { error: 'not found' });
  } catch (error) {
    // Detail stays here. The app turns a 500 into a sentence about photos
    // being safe.
    console.error('[pm] unhandled', error);
    return send(500, { error: 'internal error' });
  }
});

server.listen(PORT, () => {
  console.log(`[pm] Project Memory API on :${PORT}`);
  for (const provider of router.all()) {
    console.log(`[pm]   provider ${provider.key}: ${provider.isConfigured() ? 'ready' : 'no credentials'}`);
  }
});
