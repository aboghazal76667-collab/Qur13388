# AI providers

## The rule

**No AI vendor is ever load-bearing, and no vendor API key ever reaches a
phone.**

Everything below follows from that.

## The contract

`src/services/threeD/provider.ts`, re-exported into the server so both sides
share one definition:

```ts
interface ThreeDProvider {
  key: string;
  capabilities: ProviderCapabilities;
  isConfigured(): boolean;

  generateFromImage(request): Promise<ProviderJobStatus>;
  generateFromMultiView(request): Promise<ProviderJobStatus>;
  checkStatus(providerJobId): Promise<ProviderJobStatus>;
  downloadModel(providerJobId, format?): Promise<string | null>;
  analyzePrintability(modelUrl): Promise<PrintabilityAssessment>;
}
```

`capabilities` declares multi-view support, facial fidelity, typical duration,
approximate cost, formats, and whether the provider assesses printability
itself. The router reads it.

## Shipping implementations

| Provider | Status | Multi-view | Notes |
| --- | --- | --- | --- |
| `Mock3DProvider` | **Active by default** | Yes | Simulates a real generation, including failures |
| `MeshyProvider` | Written, needs a key | Yes | `image-to-3d` and `multi-image-to-3d` |
| `TripoProvider` | Written, needs a key | Yes | `image_to_model` and `multiview_to_model` |

## Why the mock comes first

Deliberate sequencing: **prove the product path before connecting a model.**

If a memory fails to reach the timeline while the mock is active, the bug is
ours. Connect Meshy first and every failure is ambiguous — upload, auth,
storage, polling, the model itself — and a small team can lose a week to that
ambiguity.

So: get the whole path working on a phone (create a child, add photos, request
a figurine, see a result on the timeline), *then* connect a real provider.

The mock is not a stub. It walks the real state machine, reports progress,
**fails roughly one first attempt in twelve on purpose**, and always succeeds on
retry. The failure rate is there because a demo where nothing ever fails teaches
us nothing about the recovery path — and the recovery path is what stops a
parent believing their photos were lost.

It produces no file. The app draws its demo figurine from a seed and labels it
"Demo preview" everywhere it appears. Serving a stock render as if it were a
likeness of somebody's child is the one thing this product must never do.

## Status, precisely

| Piece | State |
| --- | --- |
| Provider abstraction, router, cost ledger | **REAL** |
| `Mock3DProvider` | **REAL** as a mock — walks the true state machine, fails ~1 first attempt in 12 |
| `MeshyProvider` HTTP path | **REAL**, verified over a socket against a stand-in server (9 checks) |
| A real Meshy generation | **BLOCKED** — needs `MESHY_API_KEY` |
| Model download into our storage | **REAL** code, **untested against a live provider** |
| GLB viewer | **REAL** — three.js over expo-gl, verified rendering and rotating an actual glTF |
| Printability validation | **NOT IMPLEMENTED** — every provider reports `printability_not_assessed` |
| Face/person/view detection | **NOT IMPLEMENTED** — see the readiness section below |

## 3D readiness, and what it does not do

Readiness replaced "photo quality". It decodes the image and measures it —
Laplacian variance for blur, luma clipping for exposure, centre-versus-border
edge energy for framing and background, a difference hash for duplicates.

It cannot see a person, a face, a body, or a viewing angle. `VisionCapabilities`
declares each of those false, the UI reads the flags before it claims anything,
and a test asserts them. Viewing angles are therefore **declared by the parent**,
not detected.

Adding real vision means implementing `ReadinessAnalyzer` server-side and
flipping those flags. No screen changes.

## The quality gate

Before a generation is dispatched, the app checks the stored quality reports for
the memory's photos. If the best of them scores below 60, the parent sees the
specific problem — "this photo is quite small", "for a standing figurine, a
photo showing the whole body works best" — with *Continue anyway* next to
*Choose another photo*.

It warns rather than blocks. It is their photograph and their child, and there
are reasons to proceed a scorer cannot see.

## The router

`server/src/router.ts`. Today: use the configured provider; if it has no
credentials, fall back to the best-scoring one that does; if none do, use the
mock. A missing key degrades the *quality* of the result rather than breaking
the product.

A retry excludes the provider that just failed.

The scoring function is the seam for what this becomes:

```
facial fidelity  0.50   ← dominant: the product is a likeness of a child
multi-view       0.20
speed            0.15
cost             0.15
```

Once `provider_calls` holds real data, `score()` reads historical success rates
and actual costs instead of the static numbers each provider declares. That
change touches this one file.

## Connecting Meshy

1. Get a key from [meshy.ai](https://www.meshy.ai).
2. `cp server/.env.example server/.env` and fill in:

   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   THREE_D_PROVIDER=meshy
   MESHY_API_KEY=msy_...
   ```

3. `npm run server:install && npm run server`
4. Check `http://localhost:8787/health` — it lists each provider and whether it
   is credentialed.
5. Point the app at it with `EXPO_PUBLIC_API_BASE_URL=http://<your-ip>:8787`.

That is the whole change. No app code.

To switch to Tripo, set `THREE_D_PROVIDER=tripo`. To go back to the mock, set
`THREE_D_PROVIDER=mock`.

## Cost tracking

Every outbound call is recorded in `provider_calls` — provider, model,
operation, duration, success, HTTP status, credits, estimated cost, error code.
`measured()` in `server/src/costLedger.ts` wraps a call and files the result
whichever way it goes.

Estimates are used until there are invoices to reconcile against. Recording an
estimate is far better than recording nothing: an estimate can be corrected
later, a gap cannot. This is the only way we will ever answer the two questions
that decide whether the business works — what does one figurine cost us, and
which provider fails least.

A ledger write that fails is logged and swallowed. Our bookkeeping problem must
never become the parent's error message.

## Printability

`analyzePrintability` exists on every provider. Neither Meshy nor Tripo assesses
printability, so both return `warnings: ['printability_not_assessed']` and a
score of zero rather than a confident-looking report they did not compute.

Writing our own pass — watertightness, wall thickness, thin features at wrists
and ankles — is the next real piece of work here. Until it exists, human QA is
the gate, which is why the admin QA queue is built rather than deferred.

## What the parent sees

Never a provider name. Never an HTTP status. Five sentences:

> Preparing your memory · Understanding the photo · Building the 3D form ·
> Refining the details · Preparing your preview

And on failure:

> We couldn't finish this one yet. Your photos are safe. Nothing was lost — you
> can try again whenever you like.

The test `the generation copy never mentions AI machinery` enforces the first
part; `error copy never leaks technical detail to a parent` enforces the second.
