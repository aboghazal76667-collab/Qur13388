# Architecture decision record

Each entry is a decision we would otherwise have to re-argue, with the reason
that made it.

---

## ADR-001 — Expo + React Native + TypeScript

**Decision.** Expo SDK 57, React Native 0.86, TypeScript strict, Expo Router.

**Why.** One codebase for iPhone and Android, and the founder can see changes on
a real phone in seconds without a build machine or an Apple Developer account.
For a team this size, that feedback loop is worth more than any performance
argument for going native.

**Cost.** Some native capabilities need a custom build later. Accepted.

---

## ADR-002 — The app works with no cloud account

**Decision.** `LocalBackend` (AsyncStorage plus the app's private documents
directory) is the default. Supabase activates when its environment variables are
present.

**Why.** The brief was to build a product that runs, not a product that runs
once someone has configured a database. A non-programmer founder should be able
to hold the working thing on the first evening.

It also forced the storage abstraction to be real. An interface with one
implementation is a guess; with two it is a contract.

**Cost.** Two implementations to keep in step. Mitigated by their sharing the
same types, the same storage-path layout, and the same access rules.

---

## ADR-003 — No AI provider is called from the app

**Decision.** The app calls our server; the server holds provider credentials
and calls the provider.

**Why.** The mobile bundle is public. A Meshy key in the app is a Meshy key on
the internet.

It also gives us one place to record cost and reliability for every call, which
is what the router will eventually use to choose providers.

**Cost.** A server to run and deploy. Unavoidable given the constraint.

---

## ADR-004 — Mock3DProvider before Meshy

**Decision.** Ship on the mock. Connect a real provider only once the whole
product path works on a phone.

**Why.** This was the founder's explicit instruction, and it is right. If a
memory fails to reach the timeline while the mock is active, the bug is ours.
Connect Meshy first and every failure is ambiguous — upload, auth, storage,
polling, or the model — and a small team can lose a week to that ambiguity.

**Consequence.** The mock is not a stub. It walks the real state machine,
reports progress, and fails about one first attempt in twelve on purpose,
because a demo where nothing fails leaves the recovery path untested.

---

## ADR-005 — The demo preview is drawn, not fetched

**Decision.** The mock produces no file. The app draws a figurine from a seed
and labels it "Demo preview" wherever it appears.

**Why.** The alternative was shipping a stock 3D render. Showing a parent
somebody else's figurine as though it were a likeness of their child is the one
thing this product must never do, and "we would remove it before launch" is not
a control.

Drawing it also makes the preview genuinely interactive: dragging rotates a
parametric form with foreshortening, moving shading and a shifting contact
shadow. It is a real turntable of a real shape — just not of their child, and it
says so.

---

## ADR-006 — Content is `assets` rows, not columns on `memories`

**Decision.** A memory has no `photo_url` or `video_url`. It has `assets` rows
with a `kind` and a `meta` bag.

**Why.** The archive is meant to last twenty years and to gain video, audio,
stories, printed products and QR references along the way. Each of those as a
column is a migration against live family data. As a `kind` value it is a
constant.

---

## ADR-007 — Row-level security is the privacy boundary

**Decision.** Access is enforced in Postgres. The app's family filters exist for
efficiency and are never relied on for access control.

**Why.** A client-side filter protects nothing: anyone with the anon key — which
is in every copy of the app — can query directly. Policies in the database
cannot be forgotten by a new screen.

**Consequence.** Policies are deliberately repetitive: one helper, applied the
same way to every table. Clever policies are policies nobody can audit. They
were verified against a real Postgres with two families, and that verification
is documented so it can be repeated.

---

## ADR-008 — Families cannot write `three_d_jobs`

**Decision.** Only the server writes job rows. Families may read them, and
cancel.

**Why.** A client that could set `status` could fake a finished figurine. A
client that could insert jobs could spend our provider credits.

---

## ADR-009 — Occasions are opt-in, never defaulted

**Decision.** The occasion catalogue includes Ramadan, both Eids, Qaranqasho,
Christmas, New Year and others. Nothing is enabled by default; the family
chooses.

**Why.** A product that ships Christmas as a default and Eid as an option has
already told its customers who it was built for. Only birthday is pre-selected,
because every child has one.

---

## ADR-010 — Arabic is a first-class language

**Decision.** Two complete catalogues, RTL handled through explicit direction
props, and a test that walks the entire string object to prove Arabic is
complete.

**Why.** Retrofitting RTL is expensive and always leaves seams. Direction props
rather than `I18nManager.forceRTL` because the latter needs a native reload,
which would make switching language feel broken.

---

## ADR-011 — No optimistic updates

**Decision.** Writes go to the backend and then the store refreshes.

**Why.** The worst bug this product could have is a parent believing a memory
was saved when it was not. A brief spinner is a small price.

---

## ADR-012 — Photo quality is honest about what it measures

**Decision.** The shipping analyzer scores from image properties and reports
`inspectsPixels: false`. The UI reads that flag and words the panel accordingly.

**Why.** A panel that says "Face: Excellent" when nothing looked for a face is a
lie, and it is a lie about somebody's child. The interface is built so a real
vision model drops in without any screen changing.

Scores are derived deterministically from the image, so re-checking the same
photo gives the same answer — a scorer that changes its mind is one nobody
trusts.

A resolution ceiling was added after testing: a 0.03-megapixel image was
averaging its way to "fair" on the strength of a flattering lighting estimate.
Below about a megapixel there is not enough of the child present, and no amount
of good lighting puts the pixels back.

---

## ADR-012a — The quality report travels with the photo

**Decision.** `CreateMemoryInput.photos` carries each photo's quality report
alongside its URI, and the backend saves the report once it knows the asset id.

**Why.** The report is computed on the device before upload, when no asset id
exists yet. The obvious alternative — save the memory, list its assets, zip the
two lists by position — works right up until two uploads land in the same
millisecond and the ordering stops being stable. Handing the report to the
layer that mints the id removes the guess.

A failed report write is logged and swallowed: losing it costs a hint, never a
photograph.

---

## ADR-012b — The quality gate warns, it does not block

**Decision.** Requesting a figurine from a photo scoring below 60 shows the
specific problem and offers *Continue anyway* alongside *Choose another photo*.

**Why.** Spending a generation on a photo that cannot produce a good likeness
wastes the parent's time and our credits. But it is their photograph and their
child, and there are reasons to proceed that a scorer cannot see — it may be the
only photo that exists of that day. So we tell them what we think and let them
decide.

---

## ADR-013 — `isAwaitingResult` keys on `completed_at`, not on status

**Decision.** Whether a job still needs polling is decided by
`completed_at === null`, not by which status it holds.

**Why.** Several statuses — `raw_model_ready`, `quality_review`,
`printability_check` — are past generation but before there is a model to show.
An earlier version treated those as finished, stopped polling, and left the
progress screen waiting for a result that never came. Found by driving the real
app in a browser. The test `a job is only finished when it has an outcome`
exists to stop it returning.

---

## ADR-014 — A retry is a new job

**Decision.** Retrying creates a new `three_d_jobs` row pointing at the old one
through `retry_of_job_id`, reusing the same source photos.

**Why.** It keeps the failure history for the cost ledger, and it means the
memory and the photographs are never touched by a retry — which is what lets the
failure screen honestly say "your photos are safe".

---

## ADR-015 — No framework on the server

**Decision.** `node:http`, no Express.

**Why.** Four routes and one job. A dependency we do not take is a dependency we
never have to patch, and the server holds the most sensitive credentials in the
system.

---

## ADR-016 — Pricing is visible but inert

**Decision.** Four plan tiers are shown, labelled as a preview. No payment
provider, no card details, nothing gated.

**Why.** The founder asked not to integrate payments before the core product is
stable, which is right. Showing the shape lets the pricing be discussed without
building billing, and the `subscriptions` table is the seam for when it is time.

---

## ADR-017 — Every deletion removes files, not just rows

**Decision.** Child, memory, family-content and account deletion all remove the
storage objects.

**Why.** A deletion that leaves objects in the bucket is not a deletion. It is a
broken thumbnail with the photograph still sitting there.

---

## Open questions

- **Printability.** Neither provider assesses it and we have not written our own
  pass. Human QA is the gate until we do. This is the next real piece of work on
  the 3D side.
- **Multi-parent invites.** The schema supports several members per family;
  there is no invite flow yet.
- **Retention.** A twenty-year archive needs a stated position on dormant
  accounts.
- **Offline sync.** The device backend is a local database, not a syncing one.
  If a family uses two phones with a cloud account, they hit the network on
  every read.
