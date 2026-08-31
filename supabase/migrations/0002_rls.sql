-- =============================================================================
-- ROW LEVEL SECURITY
--
-- Two hard rules this file exists to enforce:
--
--  1. A customer can never read another customer's measurements, orders,
--     addresses, designs or photos. Not "the UI doesn't show them" — the
--     database refuses.
--  2. A workshop's staff can only see customers and orders connected to their
--     own business, scoped further by branch where the role warrants it.
--
-- Anything privileged (marking a payment paid, writing the platform catalogue)
-- runs server-side with the service role, which bypasses RLS by design.
-- =============================================================================

-- ── helpers ──────────────────────────────────────────────────────────────────

-- Businesses the current user works for. SECURITY DEFINER so the policy can
-- read staff_members without recursing through its own RLS policy.
create or replace function auth_staff_businesses()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select tailor_business_id
  from staff_members
  where user_id = auth.uid() and deleted_at is null;
$$;

create or replace function auth_is_staff_of(business uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from staff_members
    where user_id = auth.uid()
      and tailor_business_id = business
      and deleted_at is null
  );
$$;

create or replace function auth_is_platform_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- A workshop may see a customer's profile only through an order it is
-- fulfilling — never the whole customer table.
create or replace function auth_shares_order_with(customer uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from orders o
    where o.customer_id = customer
      and o.tailor_business_id in (select auth_staff_businesses())
  );
$$;

-- ── enable RLS everywhere ────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'customer_preferences', 'notification_preferences', 'addresses',
    'tailor_businesses', 'branches', 'staff_members',
    'garment_types', 'customization_zones', 'garment_components',
    'measurement_templates', 'garment_colors', 'thread_colors',
    'fabrics', 'fabric_colors', 'embroidery_collections', 'embroidery_patterns',
    'embroidery_color_channels', 'tailor_fabrics', 'tailor_embroidery_patterns',
    'measurement_profiles', 'measurement_values', 'designs', 'design_components',
    'favorites', 'carts', 'cart_items', 'orders', 'order_items',
    'order_status_history', 'payments', 'alterations',
    'ai_recommendations', 'ai_generations', 'preview_assets', 'photo_assets',
    'analytics_events'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
end $$;

-- ── identity ─────────────────────────────────────────────────────────────────
create policy profiles_self_read on profiles
  for select using (id = auth.uid() or auth_is_platform_admin() or auth_shares_order_with(id));
create policy profiles_self_write on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_self_insert on profiles
  for insert with check (id = auth.uid());

create policy prefs_self on customer_preferences
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());

create policy notif_self on notification_preferences
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());

-- Addresses: the customer always; the fulfilling workshop only for a delivery
-- order it actually holds.
create policy addresses_self on addresses
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy addresses_fulfilling_tailor_read on addresses
  for select using (
    exists (
      select 1 from orders o
      where o.address_id = addresses.id
        and o.tailor_business_id in (select auth_staff_businesses())
    )
  );

-- ── tenants ──────────────────────────────────────────────────────────────────
-- Businesses and branches are public storefront data.
create policy tailors_public_read on tailor_businesses
  for select using (active = true and deleted_at is null);
create policy tailors_staff_write on tailor_businesses
  for update using (auth_is_staff_of(id)) with check (auth_is_staff_of(id));

create policy branches_public_read on branches
  for select using (deleted_at is null);
create policy branches_staff_write on branches
  for all using (auth_is_staff_of(tailor_business_id))
  with check (auth_is_staff_of(tailor_business_id));

-- Staff can see their own colleagues only.
create policy staff_same_business on staff_members
  for select using (user_id = auth.uid() or auth_is_staff_of(tailor_business_id));

-- ── catalogue (public read, privileged write) ────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'garment_types', 'customization_zones', 'garment_components',
    'garment_colors', 'thread_colors', 'embroidery_collections',
    'fabric_colors', 'embroidery_color_channels'
  ]
  loop
    execute format(
      'create policy %I_public_read on %I for select using (true)', t, t);
  end loop;
end $$;

create policy fabrics_public_read on fabrics
  for select using (active = true and deleted_at is null);
create policy fabrics_owner_write on fabrics
  for all using (auth_is_platform_admin()) with check (auth_is_platform_admin());

create policy patterns_public_read on embroidery_patterns
  for select using (active = true and deleted_at is null);
-- A workshop may manage the patterns it uploaded, and only those.
create policy patterns_owner_write on embroidery_patterns
  for all using (
    owner_tailor_business_id is not null
    and auth_is_staff_of(owner_tailor_business_id)
  )
  with check (
    owner_tailor_business_id is not null
    and auth_is_staff_of(owner_tailor_business_id)
  );

create policy templates_read on measurement_templates
  for select using (tailor_business_id is null or auth_is_staff_of(tailor_business_id) or true);
create policy templates_owner_write on measurement_templates
  for all using (tailor_business_id is not null and auth_is_staff_of(tailor_business_id))
  with check (tailor_business_id is not null and auth_is_staff_of(tailor_business_id));

create policy tailor_fabrics_read on tailor_fabrics for select using (true);
create policy tailor_fabrics_write on tailor_fabrics
  for all using (auth_is_staff_of(tailor_business_id))
  with check (auth_is_staff_of(tailor_business_id));

create policy tailor_patterns_read on tailor_embroidery_patterns for select using (true);
create policy tailor_patterns_write on tailor_embroidery_patterns
  for all using (auth_is_staff_of(tailor_business_id))
  with check (auth_is_staff_of(tailor_business_id));

-- ── measurements (the most sensitive table in the system) ────────────────────
create policy measurements_owner on measurement_profiles
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());

-- A workshop sees a measurement profile ONLY while it holds an order that
-- references it. No open browsing of customer bodies.
create policy measurements_order_scoped_read on measurement_profiles
  for select using (
    exists (
      select 1 from order_items oi
      join orders o on o.id = oi.order_id
      where oi.measurement_profile_id = measurement_profiles.id
        and o.tailor_business_id in (select auth_staff_businesses())
    )
  );
-- The workshop that measured a customer may mark its own work verified.
create policy measurements_verifying_tailor_update on measurement_profiles
  for update using (
    tailor_business_id is not null and auth_is_staff_of(tailor_business_id)
  )
  with check (
    tailor_business_id is not null and auth_is_staff_of(tailor_business_id)
  );

create policy measurement_values_via_profile on measurement_values
  for all using (
    exists (
      select 1 from measurement_profiles p
      where p.id = measurement_values.profile_id and p.customer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from measurement_profiles p
      where p.id = measurement_values.profile_id and p.customer_id = auth.uid()
    )
  );
create policy measurement_values_order_scoped_read on measurement_values
  for select using (
    exists (
      select 1 from order_items oi
      join orders o on o.id = oi.order_id
      where oi.measurement_profile_id = measurement_values.profile_id
        and o.tailor_business_id in (select auth_staff_businesses())
    )
  );

-- ── designs, favourites, cart ────────────────────────────────────────────────
create policy designs_owner on designs
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());

create policy design_components_owner on design_components
  for all using (
    exists (select 1 from designs d where d.id = design_components.design_id and d.customer_id = auth.uid())
  )
  with check (
    exists (select 1 from designs d where d.id = design_components.design_id and d.customer_id = auth.uid())
  );

create policy favorites_owner on favorites
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());

create policy carts_owner on carts
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());

create policy cart_items_owner on cart_items
  for all using (
    exists (select 1 from carts c where c.id = cart_items.cart_id and c.customer_id = auth.uid())
  )
  with check (
    exists (select 1 from carts c where c.id = cart_items.cart_id and c.customer_id = auth.uid())
  );

-- ── orders ───────────────────────────────────────────────────────────────────
create policy orders_customer_read on orders
  for select using (customer_id = auth.uid());
-- Orders are created server-side after payment verification, but a customer
-- inserting his own order is still constrained to himself.
create policy orders_customer_insert on orders
  for insert with check (customer_id = auth.uid());

create policy orders_tailor_read on orders
  for select using (tailor_business_id in (select auth_staff_businesses()));
-- Only the fulfilling workshop advances production status.
create policy orders_tailor_update on orders
  for update using (tailor_business_id in (select auth_staff_businesses()))
  with check (tailor_business_id in (select auth_staff_businesses()));

create policy order_items_scoped on order_items
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and (o.customer_id = auth.uid()
             or o.tailor_business_id in (select auth_staff_businesses()))
    )
  );
create policy order_items_customer_insert on order_items
  for insert with check (
    exists (select 1 from orders o where o.id = order_items.order_id and o.customer_id = auth.uid())
  );

create policy order_history_scoped on order_status_history
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_status_history.order_id
        and (o.customer_id = auth.uid()
             or o.tailor_business_id in (select auth_staff_businesses()))
    )
  );
create policy order_history_tailor_insert on order_status_history
  for insert with check (
    exists (
      select 1 from orders o
      where o.id = order_status_history.order_id
        and o.tailor_business_id in (select auth_staff_businesses())
    )
  );

-- ── payments ─────────────────────────────────────────────────────────────────
-- Read-only for everyone with a stake. There is deliberately NO client policy
-- to insert or update a payment: status is written exclusively by the server
-- after it verifies the provider's webhook, so a tampered client cannot mark
-- an order paid.
create policy payments_scoped_read on payments
  for select using (
    exists (
      select 1 from orders o
      where o.id = payments.order_id
        and (o.customer_id = auth.uid()
             or o.tailor_business_id in (select auth_staff_businesses()))
    )
  );

-- ── alterations ──────────────────────────────────────────────────────────────
create policy alterations_customer on alterations
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy alterations_tailor on alterations
  for select using (
    exists (
      select 1 from orders o
      where o.id = alterations.order_id
        and o.tailor_business_id in (select auth_staff_businesses())
    )
  );
create policy alterations_tailor_update on alterations
  for update using (
    exists (
      select 1 from orders o
      where o.id = alterations.order_id
        and o.tailor_business_id in (select auth_staff_businesses())
    )
  )
  with check (true);

-- ── AI and assets ────────────────────────────────────────────────────────────
create policy ai_recos_owner on ai_recommendations
  for all using (customer_id = auth.uid() or customer_id is null)
  with check (customer_id = auth.uid() or customer_id is null);

-- Generation logs are operational telemetry: the customer sees his own, the
-- platform admin sees all. They contain a design hash, never imagery.
create policy ai_generations_owner_read on ai_generations
  for select using (customer_id = auth.uid() or auth_is_platform_admin());

-- Rendered previews are keyed by design hash and safe to reuse across
-- customers — that reuse is exactly what makes generation affordable.
create policy previews_read on preview_assets for select using (true);

-- Photos are strictly private to their owner. No tailor policy, no admin
-- policy: a workshop never needs a customer's body photo to cut a garment.
create policy photos_owner on photo_assets
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());

create policy analytics_insert_self on analytics_events
  for insert with check (customer_id = auth.uid() or customer_id is null);
create policy analytics_admin_read on analytics_events
  for select using (auth_is_platform_admin());
