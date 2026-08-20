# Database

PostgreSQL, through Supabase. Migrations are in `supabase/migrations/`, applied
in filename order.

| File | Contents |
| --- | --- |
| `0001_schema.sql` | Tables, indexes, `updated_at` triggers |
| `0002_signup.sql` | The trigger that creates a profile + family on sign-up |
| `0003_rls.sql` | Row-level security — the privacy boundary |
| `0004_storage.sql` | The private bucket and its access rules |
| `0005_functions.sql` | Export, deletion, admin overview, QA review |
| `../seed.sql` | Demo family, run manually after creating an account |

## The three rules the schema follows

**Everything a family owns carries `family_id`.** It is the single column every
security policy keys off. Denormalised on purpose: a policy that has to join
three tables to decide who may read a photograph is a policy nobody can audit.

**Content is `assets`, not columns.** A memory has no `photo_url`, no
`video_url`, no `model_url`. It has `assets` rows with a `kind` and a `meta`
bag. Video, audio, stories, print files and QR references all arrive as new
`kind` values. The archive is expected to last twenty years; it cannot need a
table rewrite each time we add something.

**UUIDs everywhere, generated client-side where useful.** A memory can be
created offline, referenced immediately, and reconciled later.

## Tables

### People

| Table | Notes |
| --- | --- |
| `profiles` | One per auth user. `is_staff` gates the admin area and is never settable from the app. `allows_model_training` is false unless a parent turns it on. |
| `families` | `occasion_keys` is the family's opted-in celebration list. |
| `family_members` | Join table with a role. The unit of sharing is the family, so multiple parents work without any schema change. |
| `children` | **First name only.** No surname, no address, no school. |

### The archive

| Table | Notes |
| --- | --- |
| `memories` | `kind` is text with a check constraint rather than an enum — adding a kind should be one line, not an `ALTER TYPE` that locks the table. `future_message` is the seed of the time capsule. |
| `assets` | Every file. `storage_path` is unique and never a public URL. |
| `photo_quality_reports` | One per asset. Records which analyzer produced it, so scores stay comparable as the analyzer improves. |

### 3D

| Table | Notes |
| --- | --- |
| `three_d_jobs` | The full 14-state lifecycle. `source_asset_ids` is an array: multi-view from day one. `retry_of_job_id` chains attempts so a retry never destroys the memory. |
| `three_d_models` | The result. `asset_id` is the heavy source file, `preview_asset_id` the light one the phone shows. |
| `provider_calls` | One row per outbound call, success or failure, with duration and estimated cost. This is the data the AI router will eventually use to choose providers. |
| `qa_reviews` | Human review before anything is manufactured. |

### Built now, used later

`stories`, `story_pages`, `capsule_messages`, `reminders`, `subscriptions`,
`orders`, `order_items`. These exist so the features can be built without a
migration that touches live family data. They are marked "Coming soon" wherever
they surface in the app.

### Instrumentation

`audit_events` records who did what. `analytics_events` records product metrics —
`props` holds counts and enums only, never a child's name, never a photograph,
never free text a parent typed.

## Row-level security

`0003_rls.sql` is the actual privacy boundary. The app also filters by family,
but that is for efficiency; a client-side filter is not a security control.

Two helper functions do the work:

```sql
is_family_member(family_id)  -- does the caller belong to this family?
is_staff()                   -- is the caller internal?
```

Both are `security definer` so they can read the membership table without being
caught by the policies they exist to support.

The pattern is deliberately repetitive — the same check applied the same way to
every table. Clever policies are policies nobody can audit.

Two asymmetries are worth knowing:

- **Families cannot write `three_d_jobs`** (except to cancel). A client that
  could set `status` could fake a finished figurine; a client that could insert
  jobs could spend our provider credits. Only the server writes them.
- **Families cannot read `provider_calls`.** What a generation costs us is
  internal.

### Verifying it

The policies were tested against a real PostgreSQL 16 with two unrelated
families, and all of the following hold:

- Parent B sees zero of parent A's children, memories and files
- Parent B cannot read parent A's child by its id
- Parent B cannot insert into parent A's family (`new row violates row-level
  security policy`)
- Parent B cannot rename parent A's family or delete their files (0 rows)
- Parent B cannot call `admin_overview()` (`staff only`)
- No parent can read `provider_calls`

Re-run this after any policy change. It takes a minute and it is the single most
important test in the repository.

## Storage

One bucket, `family-media`, private. There is no public bucket, and adding one
should require a conversation rather than a commit.

```
families/{familyId}/children/{childId}/memories/{memoryId}/{folder}/{assetId}.{ext}
```

`folder` is one of `originals`, `processed`, `previews`, `models`, `print`,
`story`, `avatars`.

The family id sits in the second path segment on purpose: the storage policy
reads it there to decide access, which keeps that rule a one-line check rather
than a parser. The device backend uses the identical layout, so moving a family
from the phone to the cloud is a copy, not a redesign.

Files are reached through short-lived signed URLs (30 minutes in the app, 20 for
the provider). Nothing persists a URL — `AssetImage` asks for a fresh one on
mount, which is what makes expiry practical rather than a source of broken
images.

## Adding a table

1. Add it in a new numbered migration, with `family_id` if a family owns it.
2. Add `enable row level security` and the four policies.
3. Add the `updated_at` trigger.
4. Add its type to `src/domain/types.ts` and its mapper to
   `src/data/supabase/rows.ts`.
5. Re-run the RLS verification above.

Step 2 is not optional. A table without policies is readable by anyone with the
anon key, which is in every copy of the app.
