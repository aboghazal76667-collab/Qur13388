# Privacy

This product stores photographs of children. That single fact sets the standard
for everything else in the repository.

## What we collect

Per child: **a first name, a date of birth, and an optional photo.** That is
all. No surname, no address, no school, no location, no gender.

Per parent: an email address and a display name.

Per memory: whatever the parent chooses to write, and the photos they choose to
add.

We do not collect a surname because the product does not need one. That is the
test each field has to pass.

## Private by default

- Child profiles are visible only to their family account. There is no public
  feed and no sharing by default.
- There is **no public storage bucket**. One bucket, private, and adding a
  public one should require a conversation rather than a commit.
- Files are reached through signed URLs that expire after 30 minutes. Nothing
  persists a URL.
- Access is checked in the database on every request, not in the app.

## The privacy boundary is the database

`supabase/migrations/0003_rls.sql` is where privacy is actually enforced. The
app filters by family too, but that is for efficiency — a client-side filter is
not a security control, and this codebase does not treat it as one.

If a policy in that file is wrong, the product is wrong, regardless of what the
app does.

The policies were verified against a real PostgreSQL 16 instance with two
unrelated families. Parent B cannot read, write, rename or delete anything
belonging to parent A — by list, by direct id, or through storage. The full list
of checks is in [DATABASE.md](DATABASE.md#verifying-it), and it should be re-run
after any policy change.

## No API keys in the app

The mobile bundle is public. Anything in it can be read by anyone who downloads
the app, including every `EXPO_PUBLIC_*` variable.

So AI provider keys live on the server (`server/.env`), and the app asks the
server for a figurine rather than asking a provider directly. The Supabase anon
key *is* in the bundle, which is what it is designed for — row-level security is
what protects the data, not the secrecy of that key.

The service-role key, which bypasses row-level security, exists only on the
server and never in any client.

## We do not train models on your children

Photographs are never used to train models. They are sent to a 3D provider only
when a parent asks for a figurine, and only for that request, through a link
that expires in twenty minutes.

There is an opt-in toggle in Settings → Privacy for using *figurine results* —
never the child's photographs — to improve quality. It is off by default and
requires an explicit action.

## Deletion means deletion

Parents can delete:

- a single photo
- a whole memory
- a child's entire profile
- all content in the family
- their account

Every path removes **the files as well as the rows**. A deletion that leaves
objects in the bucket is not a deletion — it is a broken thumbnail with the
photograph still sitting there. `delete_family_storage()` in
`0005_functions.sql` exists for exactly this, and the device backend does the
same with `deleteLocalTree`.

Account deletion also removes the login itself, and tears down the family only
when the account was its last member.

## Data export

Settings → Privacy → *Save a copy of my data* writes a JSON file to the phone
containing the family, children, memories, assets, 3D jobs and models.

Photographs are listed by storage path rather than embedded. They are already on
the device, and a base64 copy of a family's whole photo library would be both
enormous and a second copy of the thing we are protecting.

A right to your data that produces nothing you can hold is not a right, so this
actually writes a file and tells the parent where it is.

## Analytics

We record whether people finish creating a memory and whether generation
succeeds. We do not let that curiosity leak anything.

`AnalyticsProps` is typed as scalars only, and every call site passes counts and
enums — `{ kind: 'birthday', photoCount: 3 }`, never a title, never a name,
never a URL. The `analytics_events.props` column follows the same rule.

## Errors

Parents see sentences written by a human. Technical detail goes to the log sink,
never to the screen.

> We couldn't finish this memory yet. Your photos are safe — try again.

not

> HTTP 502 provider error

The test `error copy never leaks technical detail to a parent` checks every
error string for technical vocabulary, so this stays true as the copy grows.

## Still to do

Being honest about the gaps:

- **No parental-consent flow** beyond the account itself. If the product ever
  serves regions with specific children's-data regimes, that needs designing
  properly, not retrofitting.
- **No data-retention policy.** A twenty-year archive needs a stated position on
  what happens to a dormant account.
- **The local backend hashes passwords with a non-standard function.** It is
  device-only and never transmitted, and the cloud deployment uses Supabase Auth
  — but it is not a KDF and should not be mistaken for one.
- **No audit trail for staff access.** `audit_events` exists; staff reads are
  not yet written to it.
- **No rate limiting** on the server.
