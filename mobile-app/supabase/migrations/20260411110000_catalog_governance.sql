-- RLS is already enabled on product_catalog_wines; this migration replaces the
-- broad "any authenticated user can do anything" policies with ownership-scoped ones.

-- Drop existing broad policies
drop policy if exists "product_catalog_wines_select_all" on public.product_catalog_wines;
drop policy if exists "product_catalog_wines_insert_authenticated" on public.product_catalog_wines;
drop policy if exists "product_catalog_wines_update_authenticated" on public.product_catalog_wines;
drop policy if exists "product_catalog_wines_delete_authenticated" on public.product_catalog_wines;

-- Anyone authenticated can read catalog entries
create policy "catalog_select_authenticated"
  on public.product_catalog_wines for select
  to authenticated
  using (true);

-- Users can only insert their own entries
-- created_by is uuid, compared directly against auth.uid()
create policy "catalog_insert_own"
  on public.product_catalog_wines for insert
  to authenticated
  with check (created_by = auth.uid());

-- Users can only update entries they created
create policy "catalog_update_own"
  on public.product_catalog_wines for update
  to authenticated
  using (created_by = auth.uid());

-- Users can only delete entries they created
create policy "catalog_delete_own"
  on public.product_catalog_wines for delete
  to authenticated
  using (created_by = auth.uid());

-- Anon users can read (for guest mode)
create policy "catalog_select_anon"
  on public.product_catalog_wines for select
  to anon
  using (true);
